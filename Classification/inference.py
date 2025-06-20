#!/usr/bin/env python3
"""
inference.py - PyTorch model inference script for color classification
Usage: python inference.py <image_path>
"""

import sys
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import numpy as np
import os

# Import model classes (copy from your training script)
class ColorAwareConv(nn.Module):
    """Enhanced convolution block that preserves color information better"""
    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn = nn.BatchNorm2d(out_channels)
        self.act = nn.SiLU()
        
        self.color_pool = nn.AdaptiveAvgPool2d(8)
        self.color_conv = nn.Conv2d(in_channels, out_channels, kernel_size=1)
        
    def forward(self, x):
        out = self.conv(x)
        out = self.bn(out)
        out = self.act(out)
        
        # Color branch that matches output dimensions
        color_stats = self.color_pool(x)
        color_stats = self.color_conv(color_stats)
        color_features = F.adaptive_avg_pool2d(color_stats, 1)
        color_features = F.interpolate(color_features, size=out.shape[2:])
        
        return out + 0.2 * color_features

class SimplifiedMobileViTBlock(nn.Module):
    """Simplified MobileViT block with focus on color features"""
    def __init__(self, dim, depth, channel, kernel_size, patch_size, mlp_dim):
        super().__init__()
        self.ph, self.pw = patch_size
        
        self.local_rep = nn.Sequential(
            ColorAwareConv(channel, channel, stride=1),
            nn.Conv2d(channel, dim, kernel_size=1, bias=False),
            nn.BatchNorm2d(dim),
            nn.SiLU()
        )
        
        actual_depth = max(1, depth // 2)
        self.transformer = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(
                d_model=dim,
                nhead=min(4, dim // 16),
                dim_feedforward=mlp_dim,
                dropout=0.1,
                activation='gelu',
                batch_first=True
            ),
            num_layers=actual_depth
        )
        
        self.fusion = nn.Sequential(
            nn.Conv2d(dim * 2, channel, kernel_size=1, bias=False),
            nn.BatchNorm2d(channel),
            nn.SiLU()
        )
        
    def forward(self, x):
        local_rep = self.local_rep(x)
        
        y = local_rep.permute(0, 2, 3, 1)
        y = y.reshape(y.shape[0], -1, y.shape[-1])
        y = self.transformer(y)
        
        # Reshape back
        y = y.reshape(local_rep.shape[0], local_rep.shape[2], local_rep.shape[3], -1)
        y = y.permute(0, 3, 1, 2)
        
        out = torch.cat([local_rep, y], dim=1)
        out = self.fusion(out)
        
        return out

class ColorHistogramLayer(nn.Module):
    """Layer that extracts RGB color histogram features (simplified)"""
    def __init__(self, bins=16, output_dim=64):
        super().__init__()
        self.bins = bins
        self.fc = nn.Sequential(
            nn.Linear(bins * 3, output_dim),
            nn.ReLU(),
            nn.Dropout(0.1)
        )
    
    def forward(self, x):
        batch_size = x.shape[0]
        
        r_hist = self._create_hist(x[:, 0].view(batch_size, -1), 0.0, 1.0)
        g_hist = self._create_hist(x[:, 1].view(batch_size, -1), 0.0, 1.0)
        b_hist = self._create_hist(x[:, 2].view(batch_size, -1), 0.0, 1.0)
        
        hist_features = torch.cat([r_hist, g_hist, b_hist], dim=1)
        return self.fc(hist_features)
    
    def _create_hist(self, x, min_val, max_val):
        bin_edges = torch.linspace(min_val, max_val, self.bins + 1, device=x.device)
        hist = torch.zeros(x.shape[0], self.bins, device=x.device)
        
        for i in range(self.bins):
            mask = (x >= bin_edges[i]) & (x < bin_edges[i + 1])
            if i == self.bins - 1:
                mask = mask | (x == bin_edges[i + 1])
            hist[:, i] = mask.float().mean(dim=1)
        
        return hist

class MobileNetV2Block(nn.Module):
    """MobileNetV2 Inverted Residual Block"""
    def __init__(self, in_channels, out_channels, stride=1, expand_ratio=6):
        super().__init__()
        self.stride = stride
        self.use_residual = stride == 1 and in_channels == out_channels
        
        hidden_dim = in_channels * expand_ratio
        
        layers = []
        
        if expand_ratio != 1:
            layers.extend([
                nn.Conv2d(in_channels, hidden_dim, kernel_size=1, bias=False),
                nn.BatchNorm2d(hidden_dim),
                nn.ReLU6(inplace=True)
            ])
        
        layers.extend([
            nn.Conv2d(hidden_dim, hidden_dim, kernel_size=3, stride=stride, 
                     padding=1, groups=hidden_dim, bias=False),
            nn.BatchNorm2d(hidden_dim),
            nn.ReLU6(inplace=True)
        ])
        
        layers.extend([
            nn.Conv2d(hidden_dim, out_channels, kernel_size=1, bias=False),
            nn.BatchNorm2d(out_channels)
        ])
        
        self.conv = nn.Sequential(*layers)
        
    def forward(self, x):
        result = self.conv(x)
        if self.use_residual:
            return x + result
        return result

class ColorMobileViTv3(nn.Module):
    """Modified MobileViTv3 for color classification with 128x128 input using MobileNetV2 blocks"""
    def __init__(self, image_size=128, num_classes=4, variant='XXS'):
        super().__init__()
        
        if variant == 'XXS':
            channels = [16, 24, 48, 64, 80]
            transformer_dims = [64, 80, 96]
            depths = [2, 2, 2]
            mlp_dims = [128, 160, 192]
        elif variant == 'XS':
            channels = [16, 32, 48, 80, 160]
            transformer_dims = [96, 120, 160]
            depths = [2, 4, 4]
            mlp_dims = [192, 240, 320]
        else:  # variant == 'S'
            channels = [16, 32, 64, 128, 256]
            transformer_dims = [128, 160, 192]
            depths = [4, 4, 4]
            mlp_dims = [256, 320, 384]
        
        # Initial convolution
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, channels[0], kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(channels[0]),
            nn.ReLU6(inplace=True)
        )
        
        # MobileNetV2 blocks
        self.mv2_1 = MobileNetV2Block(
            in_channels=channels[0], 
            out_channels=channels[1], 
            stride=2, 
            expand_ratio=1
        )
        
        self.mv2_2 = MobileNetV2Block(
            in_channels=channels[1], 
            out_channels=channels[2], 
            stride=2, 
            expand_ratio=6
        )
        
        # MobileViT block 1
        self.mvit1 = SimplifiedMobileViTBlock(
            dim=transformer_dims[0],
            depth=depths[0],
            channel=channels[2],
            kernel_size=3,
            patch_size=(2, 2),
            mlp_dim=mlp_dims[0]
        )
        
        self.mv2_3 = MobileNetV2Block(
            in_channels=channels[2], 
            out_channels=channels[3], 
            stride=2, 
            expand_ratio=6
        )
        
        # MobileViT block 2
        self.mvit2 = SimplifiedMobileViTBlock(
            dim=transformer_dims[1],
            depth=depths[1],
            channel=channels[3],
            kernel_size=3,
            patch_size=(2, 2),
            mlp_dim=mlp_dims[1]
        )
        
        self.mv2_4 = MobileNetV2Block(
            in_channels=channels[3], 
            out_channels=channels[4], 
            stride=2, 
            expand_ratio=6
        )
        
        # MobileViT block 3
        self.mvit3 = SimplifiedMobileViTBlock(
            dim=transformer_dims[2],
            depth=depths[2],
            channel=channels[4],
            kernel_size=3,
            patch_size=(2, 2),
            mlp_dim=mlp_dims[2]
        )
        
        # Color histogram layer
        self.color_histogram = ColorHistogramLayer(bins=16, output_dim=64)
        
        # Add dropout for regularization
        self.dropout = nn.Dropout(0.2)
        self.classifier = nn.Linear(channels[4] + 64, num_classes)
        
    def forward(self, x):
        # Get color histogram features from original image
        color_hist = self.color_histogram(x)
        
        # Forward through network
        x = self.conv1(x)
        x = self.mv2_1(x)
        x = self.mv2_2(x)
        x = self.mvit1(x)
        x = self.mv2_3(x)
        x = self.mvit2(x)
        x = self.mv2_4(x)
        x = self.mvit3(x)
        
        # Global average pooling
        x = F.adaptive_avg_pool2d(x, 1)
        x = torch.flatten(x, 1)
        
        # Combine features
        combined = torch.cat([x, color_hist], dim=1)
        combined = self.dropout(combined)
        return self.classifier(combined)

class ColorClassifier:
    def __init__(self, model_path='best_color_model.pth', variant='XXS'):
        """
        Initialize the color classifier
        
        Args:
            model_path: Path to the trained model file
            variant: Model variant ('XXS', 'XS', 'S')
        """
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.variant = variant
        
        # Define class names (adjust based on your dataset)
        self.class_names = ['black', 'grey', 'red', 'white']
        
        # Data transforms for inference
        self.transform = transforms.Compose([
            transforms.Resize((128, 128)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Load model
        self.model = self._load_model(model_path)
        
    def _load_model(self, model_path):
        """Load the trained model"""
        try:
            # Create model
            model = ColorMobileViTv3(
                num_classes=len(self.class_names), 
                variant=self.variant
            )
            
            # Load weights
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found: {model_path}")
                
            state_dict = torch.load(model_path, map_location=self.device)
            model.load_state_dict(state_dict)
            
            # Set to evaluation mode
            model.eval()
            model.to(self.device)
            
            return model
            
        except Exception as e:
            raise RuntimeError(f"Failed to load model: {str(e)}")
    
    def predict(self, image_path):
        """
        Predict the class of an image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            dict: Prediction results with class, confidence, and probabilities
        """
        try:
            # Load and preprocess image
            image = Image.open(image_path).convert('RGB')
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            # Make prediction
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = F.softmax(outputs, dim=1)
                confidence, predicted = torch.max(probabilities, 1)
                
                predicted_class = self.class_names[predicted.item()]
                confidence_score = confidence.item()
                
                # Get all class probabilities
                class_probabilities = {}
                for i, class_name in enumerate(self.class_names):
                    class_probabilities[class_name] = float(probabilities[0][i])
            
            return {
                'predicted_class': predicted_class,
                'confidence': confidence_score,
                'probabilities': class_probabilities
            }
            
        except Exception as e:
            raise RuntimeError(f"Prediction failed: {str(e)}")

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print(json.dumps({
            'error': 'Usage: python inference.py <image_path>',
            'success': False
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    try:
        # Initialize classifier
        classifier = ColorClassifier()
        
        # Make prediction
        result = classifier.predict(image_path)
        
        # Output result as JSON
        output = {
            'success': True,
            'prediction': result,
            'model_info': {
                'variant': classifier.variant,
                'classes': classifier.class_names,
                'device': str(classifier.device)
            }
        }
        
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()