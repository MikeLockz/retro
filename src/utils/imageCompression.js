/**
 * Image compression and validation utilities
 * This module is lazy-loaded only when images are pasted
 */

const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB for images
const MAX_GIF_SIZE = 2 * 1024 * 1024 // 2MB for GIFs (not compressed)
const MAX_DIMENSION = 800 // Max width/height in pixels
const JPEG_QUALITY = 0.8 // JPEG compression quality

/**
 * Validates image file size and type
 * @param {File} file - The image file to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export function validateImage(file) {
    if (!file.type.startsWith('image/')) {
        return { valid: false, error: 'Only image files are supported' }
    }

    const isGif = file.type === 'image/gif'
    const maxSize = isGif ? MAX_GIF_SIZE : MAX_IMAGE_SIZE
    const fileType = isGif ? 'GIF' : 'image'

    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
        return {
            valid: false,
            error: `${fileType} must be under ${maxSizeMB}MB. Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
        }
    }

    return { valid: true }
}

/**
 * Compresses and resizes an image file
 * GIFs are not compressed to preserve animation
 * @param {File} file - The image file to process
 * @returns {Promise<string>} - Base64 encoded image data URI
 */
export async function compressImage(file) {
    // Validate first
    const validation = validateImage(file)
    if (!validation.valid) {
        throw new Error(validation.error)
    }

    // Skip compression for GIFs to preserve animation
    if (file.type === 'image/gif') {
        return fileToBase64(file)
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            const img = new Image()

            img.onload = () => {
                try {
                    // Calculate new dimensions while maintaining aspect ratio
                    let { width, height } = img

                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        if (width > height) {
                            height = Math.round((height * MAX_DIMENSION) / width)
                            width = MAX_DIMENSION
                        } else {
                            width = Math.round((width * MAX_DIMENSION) / height)
                            height = MAX_DIMENSION
                        }
                    }

                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas')
                    canvas.width = width
                    canvas.height = height

                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, width, height)

                    // Convert to JPEG for better compression
                    // (PNG images will be converted to JPEG unless they need transparency)
                    const outputFormat = file.type === 'image/png' && hasTransparency(ctx, width, height)
                        ? 'image/png'
                        : 'image/jpeg'

                    const base64 = canvas.toDataURL(outputFormat, JPEG_QUALITY)
                    resolve(base64)
                } catch (error) {
                    reject(new Error('Failed to process image: ' + error.message))
                }
            }

            img.onerror = () => {
                reject(new Error('Failed to load image'))
            }

            img.src = e.target.result
        }

        reader.onerror = () => {
            reject(new Error('Failed to read file'))
        }

        reader.readAsDataURL(file)
    })
}

/**
 * Checks if an image has transparency
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {boolean} - True if image has any transparent pixels
 */
function hasTransparency(ctx, width, height) {
    try {
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // Check alpha channel of every 10th pixel for performance
        for (let i = 3; i < data.length; i += 40) {
            if (data[i] < 255) {
                return true
            }
        }
        return false
    } catch (error) {
        // If we can't check, assume transparency to be safe
        return true
    }
}

/**
 * Converts a file directly to base64 without compression
 * Used for GIFs to preserve animation
 * @param {File} file - The file to convert
 * @returns {Promise<string>} - Base64 encoded data URI
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
    })
}

/**
 * Extracts image file from paste event
 * @param {ClipboardEvent} event - The paste event
 * @returns {File|null} - The image file or null if no image found
 */
export function getImageFromPaste(event) {
    console.log('[imageCompression] getImageFromPaste called')
    const items = event.clipboardData?.items
    console.log('[imageCompression] clipboardData.items:', items)

    if (!items) {
        console.log('[imageCompression] No items in clipboard')
        return null
    }

    console.log('[imageCompression] Items length:', items.length)
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        console.log(`[imageCompression] Item ${i}:`, item.type, item.kind)
        if (item.type.startsWith('image/')) {
            console.log('[imageCompression] Found image item, getting file...')
            const file = item.getAsFile()
            console.log('[imageCompression] Got file:', file)
            return file
        }
    }

    console.log('[imageCompression] No image found in clipboard items')
    return null
}
