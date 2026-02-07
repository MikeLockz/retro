# Image Paste Feature - Testing Checklist

## Setup
- ✅ Dev server running at http://localhost:5174/
- Open the app in your browser
- Have test images ready:
  - A regular image (JPEG/PNG) under 2MB
  - A large image over 2MB (to test size limit)
  - An animated GIF under 2MB
  - A large GIF over 2MB (to test GIF limit)

## Test 1: Basic Image Paste
1. Create a new card in any column
2. Click on the card to enter edit mode (textarea focused)
3. Copy an image (right-click → Copy Image, or screenshot)
4. Paste into the textarea (Ctrl/Cmd + V)
5. **Expected Results:**
   - You should see "Processing image..." indicator
   - Image appears below the text area within 1-2 seconds
   - Image is displayed at reasonable size (max 800px width)
   - Image has rounded corners and border

## Test 2: Image Sync Across Users
1. Open the same room URL in a second browser tab (or incognito window)
2. In Tab 1: Paste an image into a card
3. **Expected Results:**
   - Image appears in Tab 1
   - Image also appears in Tab 2 automatically (real-time sync)
   - Both tabs show identical image

## Test 3: Image with Text
1. Create a card with some text
2. While still in edit mode, paste an image
3. **Expected Results:**
   - Both text and image are displayed
   - Text appears above the image
   - Both are saved and visible after exiting edit mode

## Test 4: Image Removal
1. Create a card with an image
2. Click to edit the card
3. Hover over the image
4. Click the red trash icon in the top-right of the image
5. Confirm the removal
6. **Expected Results:**
   - Image is removed
   - Text (if any) remains
   - Change syncs to other tabs

## Test 5: Large Image Rejection
1. Copy or paste an image larger than 2MB
2. Try to paste it into a card
3. **Expected Results:**
   - Alert appears: "image must be under 2.0MB. Current size: X.XMB"
   - No image is added to the card
   - No processing indicator appears

## Test 6: Animated GIF Support
1. Copy an animated GIF (under 2MB)
2. Paste it into a card
3. **Expected Results:**
   - GIF is processed (no compression applied)
   - GIF animation plays in the card
   - GIF syncs to other tabs and keeps animating
   - No quality loss (since GIFs skip compression)

## Test 7: Image Compression Verification
1. Copy a large PNG image (e.g., 1.5MB, 2000x2000 pixels)
2. Paste it into a card
3. Open browser DevTools → Network tab → Filter by "img"
4. **Expected Results:**
   - Image is resized to max 800px (width or height)
   - Image is converted to JPEG (unless it has transparency)
   - Final size is significantly smaller (should be ~150-500KB)
   - Image quality is acceptable (JPEG quality 0.8)

## Test 8: Markdown Export with Images
1. Create several cards with a mix of:
   - Text only cards
   - Cards with images
   - Cards with both text and images
2. Click the menu (⋮) → "Export Markdown"
3. Open the downloaded .md file in a markdown viewer or text editor
4. **Expected Results:**
   - All cards are exported
   - Images are embedded as base64 data URIs: `![image](data:image/...)`
   - Markdown file can be opened and images display correctly
   - Images maintain their quality

## Test 9: Non-Image Paste
1. Copy some text
2. Paste into a card textarea
3. **Expected Results:**
   - Text is pasted normally
   - No image processing occurs
   - No errors in console

## Test 10: Multiple Images Per Session
1. Create 5-10 cards with different images
2. Navigate around the board
3. **Expected Results:**
   - All images display correctly
   - No performance degradation
   - Scrolling is smooth
   - Images load with lazy loading (check Network tab)

## Test 11: Persistence
1. Add images to several cards
2. Close the browser tab
3. Reopen the same room URL
4. **Expected Results:**
   - All images are still there (IndexedDB persistence)
   - Images load correctly from local storage
   - No need to re-sync from peers

## Test 12: Invalid File Type
1. Copy a non-image file (if possible via clipboard)
2. Try to paste into card
3. **Expected Results:**
   - Alert: "Only image files are supported"
   - No image is added

## Console Tests (Optional)
Open browser console and run:
```javascript
// Import the test utilities
import { runAllTests } from '/src/utils/imageCompression.test.js'
runAllTests()
```

**Expected Results:**
- All test assertions pass
- Console shows green checkmarks
- No errors thrown

## Known Limitations to Verify
- Images are stored as base64 (increases size by ~33%)
- GIFs over 2MB are rejected
- Images are resized to max 800px (one dimension)
- PNG with transparency stays PNG, others convert to JPEG

## Success Criteria
✅ All 12 tests pass without errors
✅ Images sync in real-time across tabs
✅ Large images are rejected appropriately
✅ Markdown export includes base64 images
✅ No console errors during any test
✅ Performance remains smooth with multiple images

## Cleanup
- Kill the dev server when done testing
- The test markdown file (IMAGE_PASTE_TESTING.md) can be deleted after testing
