/**
 * Manual test file for image compression utilities
 * Run this in the browser console to test image processing
 */

import { validateImage, compressImage, getImageFromPaste } from './imageCompression.js'

// Test 1: Validate image size limits
export function testValidation() {
    console.group('Test 1: Image Validation')

    // Mock small image file
    const smallImage = new File(['x'.repeat(100 * 1024)], 'small.jpg', { type: 'image/jpeg' })
    const smallResult = validateImage(smallImage)
    console.assert(smallResult.valid === true, 'Small image should be valid')
    console.log('✓ Small image (100KB) validated:', smallResult)

    // Mock large image file
    const largeImage = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
    const largeResult = validateImage(largeImage)
    console.assert(largeResult.valid === false, 'Large image should be invalid')
    console.log('✓ Large image (3MB) rejected:', largeResult)

    // Mock non-image file
    const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const textResult = validateImage(textFile)
    console.assert(textResult.valid === false, 'Non-image should be invalid')
    console.log('✓ Non-image file rejected:', textResult)

    // Mock GIF file
    const gifFile = new File(['x'.repeat(500 * 1024)], 'test.gif', { type: 'image/gif' })
    const gifResult = validateImage(gifFile)
    console.assert(gifResult.valid === true, 'Small GIF should be valid')
    console.log('✓ GIF file (500KB) validated:', gifResult)

    console.groupEnd()
    return true
}

// Test 2: Test paste event handling
export function testPasteExtraction() {
    console.group('Test 2: Paste Event Handling')

    // Create mock clipboard event with image
    const mockImageFile = new File(['fake'], 'test.png', { type: 'image/png' })
    const mockPasteEvent = {
        clipboardData: {
            items: [
                {
                    type: 'image/png',
                    getAsFile: () => mockImageFile
                }
            ]
        }
    }

    const extractedFile = getImageFromPaste(mockPasteEvent)
    console.assert(extractedFile !== null, 'Should extract image from paste')
    console.assert(extractedFile.type === 'image/png', 'Should extract correct type')
    console.log('✓ Image extracted from paste event:', extractedFile)

    // Create mock clipboard event without image
    const mockTextEvent = {
        clipboardData: {
            items: [
                {
                    type: 'text/plain',
                    getAsFile: () => null
                }
            ]
        }
    }

    const noImage = getImageFromPaste(mockTextEvent)
    console.assert(noImage === null, 'Should return null for text paste')
    console.log('✓ Text paste correctly returns null')

    console.groupEnd()
    return true
}

// Run all tests
export function runAllTests() {
    console.log('🧪 Running Image Compression Tests...\n')

    try {
        testValidation()
        testPasteExtraction()
        console.log('\n✅ All tests passed!')
        return true
    } catch (error) {
        console.error('❌ Tests failed:', error)
        return false
    }
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
    console.log('Image compression test utilities loaded. Run runAllTests() to test.')
}
