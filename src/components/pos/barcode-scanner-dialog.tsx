'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScanBarcode, X, Camera, CameraOff, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'

interface BarcodeScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBarcodeDetected: (barcode: string) => void
}

export function BarcodeScannerDialog({ open, onOpenChange, onBarcodeDetected }: BarcodeScannerDialogProps) {
  const { t } = useLanguage()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanningRef = useRef(false)
  const lastDetectedRef = useRef('')
  const lastDetectedTimeRef = useRef(0)

  const [cameraActive, setCameraActive] = useState(false)
  const [lastBarcode, setLastBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      scanningRef.current = true
      requestAnimationFrame(scanFrame)
    } catch (err) {
      setError(t('barcode.cameraAccessDenied'))
      setCameraActive(false)
    }
  }, [t])

  // Stop camera
  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  // Scan frame using canvas + barcode detection
  const scanFrame = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Use dynamic import for Quagga2 barcode detection
    try {
      import('@ericblade/quagga2').then((Quagga) => {
        if (!scanningRef.current) return
        
        // Convert canvas to data URL since Quagga expects a string src, not ImageData
        const dataUrl = canvas.toDataURL('image/png')
        
        Quagga.decodeSingle({
          src: dataUrl,
          numOfWorkers: 0,
          inputStream: {
            size: 800,
          },
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'code_128_reader',
              'code_39_reader',
              'upc_reader',
              'upc_e_reader',
            ],
          },
        }, (result) => {
          if (result && result.codeResult && result.codeResult.code) {
            const code = result.codeResult.code
            const now = Date.now()
            // Debounce: same barcode within 2 seconds is ignored
            if (code !== lastDetectedRef.current || now - lastDetectedTimeRef.current > 2000) {
              lastDetectedRef.current = code
              lastDetectedTimeRef.current = now
              setLastBarcode(code)
              // Vibrate if supported
              if (navigator.vibrate) navigator.vibrate(100)
            }
          }
        })
      }).catch(() => {
        // Quagga2 import failed, continue scanning
      })
    } catch {
      // Ignore errors
    }

    // Continue scanning
    setTimeout(() => {
      if (scanningRef.current) {
        requestAnimationFrame(scanFrame)
      }
    }, 500) // Scan every 500ms to reduce CPU usage
  }, [])

  // Handle barcode confirmation
  const handleConfirmBarcode = useCallback((barcode: string) => {
    if (barcode.trim()) {
      onBarcodeDetected(barcode.trim())
      stopCamera()
      onOpenChange(false)
      setLastBarcode('')
      setManualInput('')
    }
  }, [onBarcodeDetected, onOpenChange, stopCamera])

  // Handle manual input
  const handleManualSubmit = useCallback(() => {
    if (manualInput.trim()) {
      onBarcodeDetected(manualInput.trim())
      stopCamera()
      onOpenChange(false)
      setManualInput('')
    }
  }, [manualInput, onBarcodeDetected, onOpenChange, stopCamera])

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopCamera()
      setLastBarcode('')
      setError(null)
      setManualInput('')
    }
  }, [open, stopCamera])

  // Auto-start camera when dialog opens
  useEffect(() => {
    if (open && !cameraActive && !error) {
      startCamera()
    }
  }, [open, cameraActive, error, startCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) stopCamera()
      onOpenChange(val)
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-emerald-600" />
            {t('barcode.title')}
          </DialogTitle>
          <DialogDescription>
            {t('barcode.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera View */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner brackets */}
                <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                {/* Scanning line animation */}
                <div className="absolute left-8 right-8 h-0.5 bg-emerald-400/60 animate-pulse top-1/2" />
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 p-4">
                <AlertCircle className="h-10 w-10 text-amber-400" />
                <p className="text-sm text-center">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  className="text-black"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {t('barcode.retryCamera')}
                </Button>
              </div>
            )}

            {/* Not active overlay */}
            {!cameraActive && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-3">
                <CameraOff className="h-10 w-10 opacity-50" />
                <p className="text-sm opacity-70">{t('barcode.startingCamera')}</p>
              </div>
            )}
          </div>

          {/* Camera toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={cameraActive ? stopCamera : startCamera}
              className="gap-2"
            >
              {cameraActive ? (
                <>
                  <CameraOff className="h-4 w-4" />
                  {t('barcode.stopCamera')}
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  {t('barcode.startCamera')}
                </>
              )}
            </Button>

            {/* Last detected barcode */}
            {lastBarcode && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-emerald-700 border-emerald-200 bg-emerald-50">
                  {lastBarcode}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => handleConfirmBarcode(lastBarcode)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {t('barcode.addProduct')}
                </Button>
              </div>
            )}
          </div>

          {/* Manual input fallback */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t('barcode.manualFallback')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualSubmit()
                }}
                placeholder={t('barcode.enterManually')}
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                size="sm"
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {t('barcode.search')}
              </Button>
            </div>
          </div>

          {/* Supported formats */}
          <p className="text-[10px] text-muted-foreground">
            {t('barcode.supportedFormats')}: EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
