#!/usr/bin/env python3
"""
Create a simple favicon for Ryokushen Financial
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_favicon():
    # Create a 64x64 image with a dark background
    size = 64
    img = Image.new('RGBA', (size, size), (15, 23, 42, 255))  # Dark blue matching your theme
    draw = ImageDraw.Draw(img)
    
    # Draw a gradient circle background
    center = size // 2
    radius = size // 2 - 4
    
    # Create gradient effect
    for i in range(radius, 0, -1):
        alpha = int(255 * (i / radius))
        color = (59, 130, 246, alpha)  # Blue gradient
        draw.ellipse([center-i, center-i, center+i, center+i], fill=color)
    
    # Draw dollar sign
    try:
        # Try to use a system font
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Draw $ symbol
    text = "$"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 4
    
    # Draw text with shadow
    draw.text((x+2, y+2), text, fill=(0, 0, 0, 128), font=font)  # Shadow
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)  # White text
    
    # Save as ICO format
    img.save('favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (64, 64)])
    
    # Also save PNG versions
    img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    img_32.save('favicon-32x32.png', 'PNG')
    
    img_16 = img.resize((16, 16), Image.Resampling.LANCZOS)
    img_16.save('favicon-16x16.png', 'PNG')
    
    print("Favicon created successfully!")
    print("Files created:")
    print("- favicon.ico")
    print("- favicon-32x32.png") 
    print("- favicon-16x16.png")

if __name__ == "__main__":
    try:
        from PIL import Image, ImageDraw, ImageFont
        create_favicon()
    except ImportError:
        print("Pillow library not installed. Creating a simple text file as placeholder.")
        with open('favicon.ico', 'wb') as f:
            # Write a minimal valid ICO header as placeholder
            f.write(b'\x00\x00\x01\x00\x01\x00\x10\x10\x00\x00\x01\x00\x01\x00')
            f.write(b'\x00' * 1000)  # Placeholder data
        print("Created placeholder favicon.ico")
        print("To create a proper favicon, install Pillow: pip install Pillow")