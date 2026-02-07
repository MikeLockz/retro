import { useState, useEffect, useCallback } from 'react'
import store from '../Store'

/**
 * React hook for binding Y.Text to a textarea
 * Provides real-time collaborative text editing with minimal cursor disruption
 */
export function useYText(textId) {
    const [yText, setYText] = useState(null)
    const [text, setText] = useState('')

    useEffect(() => {
        if (!textId) return

        const cardTexts = store.doc.getMap('cardTexts')
        const yTextInstance = cardTexts.get(textId)

        if (!yTextInstance) {
            console.warn(`[useYText] Y.Text not found for ${textId}`)
            return
        }

        setYText(yTextInstance)
        setText(yTextInstance.toString())

        // Subscribe to Y.Text changes from remote users
        const observer = () => {
            setText(yTextInstance.toString())
        }

        yTextInstance.observe(observer)

        return () => {
            yTextInstance.unobserve(observer)
        }
    }, [textId])

    /**
     * Update Y.Text with minimal diff to avoid cursor jumping
     * This computes the minimal set of insert/delete operations needed
     */
    const updateText = useCallback((newText) => {
        if (!yText) return

        const currentText = yText.toString()

        // No change, skip update
        if (newText === currentText) return

        const minLen = Math.min(currentText.length, newText.length)
        let startDiff = 0
        let endDiff = 0

        // Find start of difference
        while (startDiff < minLen && currentText[startDiff] === newText[startDiff]) {
            startDiff++
        }

        // Find end of difference
        while (
            endDiff < minLen - startDiff &&
            currentText[currentText.length - 1 - endDiff] === newText[newText.length - 1 - endDiff]
        ) {
            endDiff++
        }

        const deleteLength = currentText.length - startDiff - endDiff
        const insertText = newText.substring(startDiff, newText.length - endDiff)

        // Apply minimal changes to Y.Text
        store.doc.transact(() => {
            if (deleteLength > 0) {
                yText.delete(startDiff, deleteLength)
            }
            if (insertText.length > 0) {
                yText.insert(startDiff, insertText)
            }
        })
    }, [yText])

    return {
        yText,
        text,
        updateText,
        isReady: !!yText
    }
}
