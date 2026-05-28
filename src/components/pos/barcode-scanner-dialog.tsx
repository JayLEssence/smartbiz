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
import { CheckCircle2, Camera, CameraOff, AlertCircle, ScanBarcode } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'

interface BarcodeScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBarcodeDetected: (barcode: string) => void
}

// Cache Quagga2 module after first import
let quaggaCache: typeof import('@ericblade/quagga2') | null = null
let quaggaLoadError = false

async function getQuagga() {
  if (quaggaCache) return quaggaCache
  if (quaggaLoadError) return null
  try {
    quaggaCache = await import('@ericblade/quagga2')
    return quaggaCache
  } catch {
    quaggaLoadError = true
    return null
  }
}

export function BarcodeScannerDialog({ open, onOpenChange, onBarcodeDetected }: BarcodeScannerDialogProps) {
  const { t } = useLanguage()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanningRef = useRef(false)
  const lastDetectedRef = useRef('')
  const lastDetectedTimeRef = useRef(0)
  const decodingRef = useRef(false)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanFrameRef = useRef<() => void>(() => {})

  const [cameraActive, setCameraActive] = useState(false)
  const [lastBarcode, setLastBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [scanCount, setScanCount] = useState(0)
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'detected'>('idle')

  // Schedule next scan with a delay
  const scheduleNextScan = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current)
    }
    scanTimerRef.current = setTimeout(() => {
      if (scanningRef.current) {
        scanFrameRef.current()
      }
    }, 300)
  }, [])

  // Scan frame implementation (assigned to ref to avoid circular deps)
  useEffect(() => {
    scanFrameRef.current = async () => {
      if (!scanningRef.current || !videoRef.current || !canvasRef.current) return
      if (decodingRef.current) {
        scheduleNextScan()
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx || video.readyState < video.HAVE_ENOUGH_DATA) {
        scheduleNextScan()
        return
      }

      const vw = video.videoWidth
      const vh = video.videoHeight
      if (vw === 0 || vh === 0) {
        scheduleNextScan()
        return
      }

      canvas.width = vw
      canvas.height = vh
      ctx.drawImage(video, 0, 0, vw, vh)

      // Crop center region for better detection
      const cropX = Math.floor(vw * 0.1)
      const cropY = Math.floor(vh * 0.2)
      const cropW = Math.floor(vw * 0.8)
      const cropH = Math.floor(vh * 0.6)
      const imageData = ctx.getImageData(cropX, cropY, cropW, cropH)

      decodingRef.current = true

      try {
        const Quagga = await getQuagga()
        if (!Quagga || !scanningRef.current) {
          decodingRef.current = false
          scheduleNextScan()
          return
        }

        // Create a temporary canvas for the cropped region
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = cropW
        tempCanvas.height = cropH
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) {
          decodingRef.current = false
          scheduleNextScan()
          return
        }
        tempCtx.putImageData(imageData, 0, 0)
        const dataUrl = tempCanvas.toDataURL('image/png')

        Quagga.decodeSingle({
          src: dataUrl,
          numOfWorkers: 0,
          inputStream: {
            size: 1024,
          },
          locator: {
            patchSize: 'medium',
            halfSample: true,
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
            multiple: false,
          },
          locate: true,
        }, (result) => {
          decodingRef.current = false
          if (result && result.codeResult && result.codeResult.code) {
            const code = result.codeResult.code
            const now = Date.now()
            if (code !== lastDetectedRef.current || now - lastDetectedTimeRef.current > 3000) {
              lastDetectedRef.current = code
              lastDetectedTimeRef.current = now
              setLastBarcode(code)
              setStatus('detected')
              setScanCount(prev => prev + 1)
              if (navigator.vibrate) navigator.vibrate(100)
            }
          }
          if (scanningRef.current) {
            scheduleNextScan()
          }
        })
      } catch {
        decodingRef.current = false
        if (scanningRef.current) {
          scheduleNextScan()
        }
      }
    }
  }, [scheduleNextScan])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null)
      setStatus('starting')

      // Pre-load Quagga2 while camera starts
      getQuagga()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      setStatus('scanning')
      scanningRef.current = true
      scheduleNextScan()
    } catch (err) {
      console.error('Camera error:', err)
      setError(t('barcode.cameraAccessDenied'))
      setCameraActive(false)
      setStatus('idle')
    }
  }, [t, scheduleNextScan])

  // Stop camera
  const stopCamera = useCallback(() => {
    scanningRef.current = false
    decodingRef.current = false
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current)
      scanTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setStatus('idle')
  }, [])

  // Handle barcode confirmation
  const handleConfirmBarcode = useCallback((barcode: string) => {
    if (barcode.trim()) {
      onBarcodeDetected(barcode.trim())
      stopCamera()
      onOpenChange(false)
      setLastBarcode('')
      setManualInput('')
      setStatus('idle')
      setScanCount(0)
    }
  }, [onBarcodeDetected, onOpenChange, stopCamera])

  // Handle manual input
  const handleManualSubmit = useCallback(() => {
    if (manualInput.trim()) {
      onBarcodeDetected(manualInput.trim())
      stopCamera()
      onOpenChange(false)
      setManualInput('')
      setStatus('idle')
    }
  }, [manualInput, onBarcodeDetected, onOpenChange, stopCamera])

  // Cleanup on close - handled by onOpenChange
  // Auto-start camera when dialog opens - handled by onOpenChange
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false
      decodingRef.current = false
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (val) {
        // Opening - start camera
        startCamera()
      } else {
        // Closing - stop camera and reset
        stopCamera()
        setLastBarcode('')
        setError(null)
        setManualInput('')
        setStatus('idle')
        setScanCount(0)
      }
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
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Semi-transparent dark border overlay */}
                <div className="absolute inset-0">
                  <div className="absolute top-0 left-0 right-0 h-[20%] bg-black/40" />
                  <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black/40" />
                  <div className="absolute top-[20%] bottom-[20%] left-0 w-[10%] bg-black/40" />
                  <div className="absolute top-[20%] bottom-[20%] right-0 w-[10%] bg-black/40" />
                </div>

                {/* Scanning window corners */}
                <div className="absolute top-[20%] left-[10%] w-8 h-8 border-t-3 border-l-3 border-emerald-400 rounded-tl-sm" />
                <div className="absolute top-[20%] right-[10%] w-8 h-8 border-t-3 border-r-3 border-emerald-400 rounded-tr-sm" />
                <div className="absolute bottom-[20%] left-[10%] w-8 h-8 border-b-3 border-l-3 border-emerald-400 rounded-bl-sm" />
                <div className="absolute bottom-[20%] right-[10%] w-8 h-8 border-b-3 border-r-3 border-emerald-400 rounded-br-sm" />

                {/* Animated scanning line */}
                <div
                  className="absolute left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent scan-line"
                  style={{
                    boxShadow: '0 0 8px 2px rgba(52, 211, 153, 0.4)',
                  }}
                />

                {/* Status indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                  <div className={`h-2 w-2 rounded-full ${
                    status === 'detected' ? 'bg-emerald-400' : status === 'scanning' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'
                  }`} />
                  <span className="text-[10px] text-white font-medium">
                    {status === 'detected' ? 'Found!' : status === 'scanning' ? 'Scanning...' : 'Starting...'}
                  </span>
                </div>

                {/* Scan count */}
                {scanCount > 0 && (
                  <div className="absolute top-3 left-3 bg-black/60 rounded-full px-2.5 py-1">
                    <span className="text-[10px] text-white font-medium">{scanCount} detected</span>
                  </div>
                )}

                {/* Tip text */}
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="text-[10px] text-white/70 bg-black/50 rounded px-2 py-0.5">
                    Point camera at barcode • Center the code
                  </span>
                </div>
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

          {/* Detected barcode - prominent display */}
          {lastBarcode && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Barcode detected</p>
                <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 truncate">{lastBarcode}</p>
              </div>
              <Button
                size="sm"
                onClick={() => handleConfirmBarcode(lastBarcode)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {t('barcode.addProduct')}
              </Button>
            </div>
          )}

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

            {!lastBarcode && cameraActive && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Scanning...
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
