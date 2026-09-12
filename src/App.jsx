import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const APERTURES = [
  {
    id: 'small',
    label: 'Small · comparable',
    ratio: 1,
    short: 'a = 1λ',
    verdict: 'Strong diffraction',
    description:
      'The aperture width is comparable to the wavelength, so the transmitted wave spreads through a wide range of angles. For light, the central maximum is wide.',
  },
  {
    id: 'medium',
    label: 'Medium · a few λ',
    ratio: 3,
    short: 'a = 3λ',
    verdict: 'Moderate diffraction',
    description:
      'Contributions reinforce most strongly in the forward direction. Away from the centre, more cancellation narrows the spread and the central maximum.',
  },
  {
    id: 'large',
    label: 'Large · many λ',
    ratio: 6,
    short: 'a = 6λ',
    verdict: 'Limited diffraction',
    description:
      'Many parts of the aperture contribute. Off-axis phase differences cause cancellation, leaving a mainly forward-moving wave and a narrow central maximum.',
  },
]

const MODULES = [
  {
    id: 'double-slit',
    title: 'Double slit',
    description: 'Explore path difference, phase and interference fringes.',
    status: 'Open investigation',
    accent: '#287fbd',
  },
  {
    id: 'diffraction-grating',
    title: 'Diffraction grating',
    description: 'See how many coherent slits produce sharp principal maxima.',
    status: 'Open investigation',
    accent: '#6552bd',
  },
  {
    id: 'huygens',
    title: 'Huygens’ wavelets',
    description: 'Build a diffracted wave from coherent secondary wavelets.',
    status: 'Open investigation',
    accent: '#168b86',
  },
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const formatValue = (value) => Number(value.toFixed(2)).toString()

function describeRatio(ratio) {
  const template = ratio <= 1.25 ? APERTURES[0] : ratio <= 4 ? APERTURES[1] : APERTURES[2]
  const isNarrowerThanWavelength = ratio < 0.8
  return {
    ...template,
    id: 'custom',
    ratio,
    short: `a/λ = ${formatValue(ratio)}`,
    verdict: isNarrowerThanWavelength ? 'Wide spread · weak transmission' : template.verdict,
    description: isNarrowerThanWavelength
      ? 'The aperture is narrower than one wavelength. The transmitted wave is weak and spreads across almost the full forward half-space.'
      : template.description,
  }
}

function IconPlay({ paused }) {
  return paused ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zm7 0h3v14h-3z" /></svg>
  )
}

function IconNudge() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 5 10 7-10 7V5Zm11 0h2v14h-2V5Z" />
    </svg>
  )
}

function WaveCanvas({
  aperture,
  apertureWidth = aperture.ratio,
  wavelengthScale = 1,
  measurementLabel = aperture.short,
  sourceCount,
  showWavelets,
  showResultant,
  paused,
  playbackSpeed,
  inspectionPoint = null,
  onInspect,
}) {
  const canvasRef = useRef(null)
  const modelRef = useRef(null)
  const settingsRef = useRef({ aperture, apertureWidth, wavelengthScale, measurementLabel, sourceCount, showWavelets, showResultant, paused, playbackSpeed, inspectionPoint })

  useEffect(() => {
    settingsRef.current = { aperture, apertureWidth, wavelengthScale, measurementLabel, sourceCount, showWavelets, showResultant, paused, playbackSpeed, inspectionPoint }
  }, [aperture, apertureWidth, wavelengthScale, measurementLabel, sourceCount, showWavelets, showResultant, paused, playbackSpeed, inspectionPoint])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d', { alpha: false })
    const fieldCanvas = document.createElement('canvas')
    const fieldContext = fieldCanvas.getContext('2d')
    let frameId
    let lastTime = performance.now()
    let lastRenderedTime = 0
    let travelledDistance = 0
    let width = 0
    let height = 0
    let combinedFieldCache = null
    let combinedFieldKey = ''

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(320, Math.floor(rect.width))
      height = Math.max(360, Math.floor(rect.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Render at roughly one field sample per displayed CSS pixel. The caps
      // protect unusually large windows without reintroducing visible scaling.
      fieldCanvas.width = clamp(Math.ceil(width * 0.66), 210, 900)
      fieldCanvas.height = clamp(Math.ceil(height), 360, 640)
      combinedFieldKey = ''
    }

    const drawBackground = () => {
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#06111b')
      gradient.addColorStop(0.5, '#081b28')
      gradient.addColorStop(1, '#06131e')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      context.strokeStyle = 'rgba(129, 166, 184, 0.065)'
      context.lineWidth = 1
      const grid = 34
      for (let x = 0; x < width; x += grid) {
        context.beginPath()
        context.moveTo(x + 0.5, 0)
        context.lineTo(x + 0.5, height)
        context.stroke()
      }
      for (let y = 0; y < height; y += grid) {
        context.beginPath()
        context.moveTo(0, y + 0.5)
        context.lineTo(width, y + 0.5)
        context.stroke()
      }
    }

    const draw = (now) => {
      if (now - lastRenderedTime < 33) {
        frameId = requestAnimationFrame(draw)
        return
      }

      const elapsed = Math.min(50, now - lastTime)
      lastTime = now
      lastRenderedTime = now
      const settings = settingsRef.current
      if (!settings.paused) {
        travelledDistance += elapsed * 0.055 * settings.playbackSpeed
      }

      const unitLength = clamp(height * 0.085, 29, 38)
      const wavelength = unitLength * settings.wavelengthScale
      const phase = travelledDistance % wavelength
      const barrierX = width * 0.34
      const centreY = height * 0.5
      const gapHeight = unitLength * settings.apertureWidth
      const gapTop = centreY - gapHeight / 2
      const gapBottom = centreY + gapHeight / 2
      const sourceTotal = settings.sourceCount
      const sources = Array.from({ length: sourceTotal }, (_, index) => {
        return {
          x: barrierX + 2,
          y: gapTop + (index / (sourceTotal - 1)) * gapHeight,
        }
      })
      modelRef.current = {
        width,
        height,
        barrierX,
        centreY,
        wavelength,
        travelledDistance,
        apertureRatio: settings.aperture.ratio,
        sourceCount: sourceTotal,
      }

      drawBackground()

      // The incident plane wave: parallel wavefronts approaching the aperture.
      context.save()
      context.beginPath()
      context.rect(0, 0, barrierX - 5, height)
      context.clip()
      for (let x = barrierX - wavelength + phase; x > -wavelength; x -= wavelength) {
        const glow = context.createLinearGradient(x - 5, 0, x + 5, 0)
        glow.addColorStop(0, 'rgba(61, 216, 255, 0)')
        glow.addColorStop(0.5, 'rgba(126, 235, 255, 0.88)')
        glow.addColorStop(1, 'rgba(61, 216, 255, 0)')
        context.fillStyle = glow
        context.fillRect(x - 6, 0, 12, height)
        context.strokeStyle = 'rgba(211, 249, 255, 0.92)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      context.restore()

      // A continuous-aperture teaching model. The sinc envelope gives the
      // single-slit spread, while a smooth transmission factor makes openings
      // much narrower than one wavelength broad but faint. Drawn source points
      // do not enter this calculation.
      if (settings.showResultant) {
        const fw = fieldCanvas.width
        const fh = fieldCanvas.height
        const cacheKey = [fw, fh, width, height, settings.apertureWidth, settings.wavelengthScale].join(':')
        if (cacheKey !== combinedFieldKey) {
          const fieldReal = new Float32Array(fw * fh)
          const fieldImaginary = new Float32Array(fw * fh)
          const apertureWidthUnits = settings.apertureWidth
          const wavelengthUnits = settings.wavelengthScale
          const apertureToWavelength = apertureWidthUnits / wavelengthUnits
          const waveNumberUnits = 2 * Math.PI / wavelengthUnits
          const transmissionAmplitude = apertureToWavelength / Math.sqrt(1 + apertureToWavelength * apertureToWavelength)
          const curvature = 1 / (1 + Math.pow(apertureToWavelength / 2, 2))
          const transitionStart = 0.75 * wavelengthUnits
          const farFieldDistance = Math.max(
            4 * wavelengthUnits,
            0.65 * apertureWidthUnits * apertureWidthUnits / wavelengthUnits,
          )
          const spreadSlope = Math.min(2.5, wavelengthUnits / Math.max(0.08, apertureWidthUnits))
          const smoothStep = (value) => {
            const bounded = clamp(value, 0, 1)
            return bounded * bounded * (3 - 2 * bounded)
          }

          for (let py = 0; py < fh; py += 1) {
            const transversePosition = ((py / (fh - 1)) * height - centreY) / unitLength
            for (let px = 0; px < fw; px += 1) {
              const longitudinalPosition = (px / (fw - 1)) * (width - barrierX) / unitLength
              const fieldIndex = py * fw + px

              if (longitudinalPosition < 1e-5) {
                fieldReal[fieldIndex] = Math.abs(transversePosition) <= apertureWidthUnits / 2 ? transmissionAmplitude : 0
                fieldImaginary[fieldIndex] = 0
                continue
              }

              const radialDistance = Math.hypot(longitudinalPosition, transversePosition)
              const sineTheta = transversePosition / radialDistance
              const farFieldEnvelope = sinc(Math.PI * apertureToWavelength * sineTheta)
              const nearFieldHalfWidth = apertureWidthUnits / 2 + longitudinalPosition * spreadSlope
              const nearFieldEnvelope = Math.exp(
                -0.5 * Math.pow(Math.abs(transversePosition) / Math.max(0.08, nearFieldHalfWidth), 8),
              )
              const farFieldEmergence = smoothStep(
                (longitudinalPosition - transitionStart) / Math.max(0.2, farFieldDistance - transitionStart),
              )
              const diffractionEnvelope = nearFieldEnvelope
                + (farFieldEnvelope - nearFieldEnvelope) * farFieldEmergence
              const amplitude = transmissionAmplitude * diffractionEnvelope

              // Elliptical phase fronts give the intended qualitative transition:
              // almost circular for a small gap and almost plane for a wide one.
              const propagationDistance = Math.hypot(longitudinalPosition, transversePosition * curvature)
              const propagationPhase = waveNumberUnits * propagationDistance
              const phaseCosine = Math.cos(propagationPhase)
              const phaseSine = Math.sin(propagationPhase)

              fieldReal[fieldIndex] = amplitude * phaseCosine
              fieldImaginary[fieldIndex] = amplitude * phaseSine
            }
          }

          combinedFieldCache = { real: fieldReal, imaginary: fieldImaginary }
          combinedFieldKey = cacheKey
        }

        const image = fieldContext.createImageData(fw, fh)
        const pixels = image.data
        const timeAngle = 2 * Math.PI * phase / wavelength
        const timeCosine = Math.cos(timeAngle)
        const timeSine = Math.sin(timeAngle)
        const background = [8, 22, 34]

        for (let fieldIndex = 0; fieldIndex < fw * fh; fieldIndex += 1) {
          const displacement = combinedFieldCache.real[fieldIndex] * timeCosine
            + combinedFieldCache.imaginary[fieldIndex] * timeSine
          const colourStrength = clamp(Math.abs(displacement), 0, 1)
          const targetColour = displacement >= 0 ? [114, 236, 255] : [255, 112, 93]
          const pixelIndex = fieldIndex * 4
          pixels[pixelIndex] = Math.round(background[0] + (targetColour[0] - background[0]) * colourStrength)
          pixels[pixelIndex + 1] = Math.round(background[1] + (targetColour[1] - background[1]) * colourStrength)
          pixels[pixelIndex + 2] = Math.round(background[2] + (targetColour[2] - background[2]) * colourStrength)
          pixels[pixelIndex + 3] = 255
        }

        fieldContext.putImageData(image, 0, 0)
        context.save()
        context.imageSmoothingEnabled = false
        context.drawImage(fieldCanvas, barrierX, 0, width - barrierX, height)
        context.restore()
      }

      // The secondary wavelets used in Huygens' construction.
      if (settings.showWavelets) {
        context.save()
        context.beginPath()
        context.rect(barrierX, 0, width - barrierX, height)
        context.clip()
        context.lineWidth = sourceTotal > 25 ? 0.78 : 1.05
        const maxRadius = Math.hypot(width - barrierX, height)
        for (const source of sources) {
          for (let radius = phase + wavelength * 0.36; radius < maxRadius; radius += wavelength) {
            const fade = clamp(1 - radius / maxRadius, 0.06, 0.65)
            context.strokeStyle = `rgba(151, 240, 255, ${fade * (sourceTotal > 25 ? 0.24 : 0.42)})`
            context.beginPath()
            context.arc(source.x, source.y, radius, -Math.PI / 2, Math.PI / 2)
            context.stroke()
          }
        }
        context.restore()
      }

      // Opaque barrier and aperture edges.
      context.fillStyle = '#dbe8ed'
      context.shadowColor = 'rgba(200, 242, 255, 0.45)'
      context.shadowBlur = 8
      context.fillRect(barrierX - 4, 0, 8, gapTop)
      context.fillRect(barrierX - 4, gapBottom, 8, height - gapBottom)
      context.shadowBlur = 0

      // Source samples across the open part of the incident wavefront.
      context.fillStyle = '#ffd47a'
      context.shadowColor = '#ffd47a'
      context.shadowBlur = 8
      for (const source of sources) {
        context.beginPath()
        context.arc(source.x + 1, source.y, sourceTotal > 25 ? 1.5 : 2.1, 0, Math.PI * 2)
        context.fill()
      }
      context.shadowBlur = 0

      // In-canvas labels and aperture measurement.
      context.font = '600 11px Inter, system-ui, sans-serif'
      context.letterSpacing = '0.06em'
      context.fillStyle = 'rgba(213, 235, 242, 0.72)'
      context.fillText(width < 520 ? 'INCIDENT WAVE' : 'INCIDENT PLANE WAVE', 18, 25)
      context.fillText(width < 520 ? 'DIFFRACTED' : 'DIFFRACTED WAVE', barrierX + 18, 25)

      const measureX = barrierX - 18
      context.strokeStyle = '#ffd47a'
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(measureX, gapTop + 3)
      context.lineTo(measureX, gapBottom - 3)
      context.moveTo(measureX - 4, gapTop + 3)
      context.lineTo(measureX + 4, gapTop + 3)
      context.moveTo(measureX - 4, gapBottom - 3)
      context.lineTo(measureX + 4, gapBottom - 3)
      context.stroke()
      context.save()
      context.translate(measureX - 8, centreY)
      context.rotate(-Math.PI / 2)
      context.textAlign = 'center'
      context.fillStyle = '#ffd47a'
      context.fillText(settings.measurementLabel, 0, 0)
      context.restore()

      if (settings.inspectionPoint) {
        const pointX = barrierX + settings.inspectionPoint.u * (width - barrierX)
        const pointY = settings.inspectionPoint.v * height
        context.strokeStyle = '#ffd47a'
        context.fillStyle = '#07131f'
        context.lineWidth = 1.5
        context.shadowColor = '#ffd47a'
        context.shadowBlur = 10
        context.beginPath()
        context.arc(pointX, pointY, 7, 0, Math.PI * 2)
        context.fill()
        context.stroke()
        context.beginPath()
        context.moveTo(pointX - 12, pointY)
        context.lineTo(pointX + 12, pointY)
        context.moveTo(pointX, pointY - 12)
        context.lineTo(pointX, pointY + 12)
        context.stroke()
        context.shadowBlur = 0
      }

      frameId = requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    frameId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [])

  const handleInspect = (event) => {
    if (!onInspect || !modelRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const model = modelRef.current
    const x = (event.clientX - rect.left) * (model.width / rect.width)
    const y = (event.clientY - rect.top) * (model.height / rect.height)
    if (x <= model.barrierX + 4) return

    onInspect({
      u: (x - model.barrierX) / (model.width - model.barrierX),
      v: y / model.height,
      pointX: (x - model.barrierX) / model.wavelength,
      pointY: (y - model.centreY) / model.wavelength,
      phaseCycles: model.travelledDistance / model.wavelength,
      cyclesPerSecond: 55 / model.wavelength,
      apertureRatio: model.apertureRatio,
      sourceCount: model.sourceCount,
    })
  }

  return (
    <canvas
      ref={canvasRef}
      className={`wave-canvas${onInspect ? ' inspectable' : ''}`}
      role="img"
      onClick={handleInspect}
      aria-label={`Animated Huygens construction for an aperture ${aperture.ratio} wavelengths wide, sampled with ${sourceCount} secondary wavelet sources.`}
    />
  )
}

function ComparisonCard({ item, paused, playbackSpeed, onExplore }) {
  const sourceCount = Math.min(49, Math.max(13, Math.round(item.ratio * 7)))

  return (
    <article className="comparison-card">
      <header>
        <div>
          <span>{item.short}</span>
          <small>{item.label}</small>
        </div>
        <strong>{item.verdict}</strong>
      </header>
      <button
        className="comparison-canvas"
        type="button"
        onClick={() => onExplore(item)}
        aria-label={'Open ' + item.label + ' in the variable explorer'}
      >
        <WaveCanvas
          aperture={item}
          sourceCount={sourceCount}
          showWavelets={false}
          showResultant
          paused={paused}
          playbackSpeed={playbackSpeed}
        />
      </button>
    </article>
  )
}

function InterferenceInspector({ point, onClose, playbackSpeed, initiallyPaused }) {
  const [phaseCycles, setPhaseCycles] = useState(point.phaseCycles)
  const [isPlaying, setIsPlaying] = useState(!initiallyPaused)

  useEffect(() => {
    setPhaseCycles(point.phaseCycles)
  }, [point.u, point.v, point.phaseCycles])

  useEffect(() => {
    if (!isPlaying) return undefined
    let frameId
    let lastUpdate = performance.now()

    const advance = (now) => {
      const elapsed = Math.min(80, now - lastUpdate)
      if (elapsed >= 33) {
        setPhaseCycles((value) => value + (elapsed / 1000) * point.cyclesPerSecond * playbackSpeed)
        lastUpdate = now
      }
      frameId = requestAnimationFrame(advance)
    }

    frameId = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frameId)
  }, [isPlaying, playbackSpeed, point.cyclesPerSecond])

  const plot = useMemo(() => {
    const width = 820
    const height = 220
    const left = 58
    const right = 796
    const top = 12
    const bottom = 168
    const middleY = (top + bottom) / 2
    const amplitudeScale = (bottom - top) * 0.43
    const halfSpan = 1.5
    const sampleTotal = 241
    const sourceTotal = point.sourceCount
    const sourceYs = Array.from({ length: sourceTotal }, (_, index) => (
      -point.apertureRatio / 2 + (index / (sourceTotal - 1)) * point.apertureRatio
    ))
    const timeOffsets = Array.from({ length: sampleTotal }, (_, index) => (
      -halfSpan + (index / (sampleTotal - 1)) * halfSpan * 2
    ))
    const toX = (timeOffset) => left + ((timeOffset + halfSpan) / (halfSpan * 2)) * (right - left)
    const toY = (amplitude) => middleY - amplitude * amplitudeScale
    const resultant = new Array(sampleTotal).fill(0)
    const weightSum = sourceTotal - 1

    const componentPaths = sourceYs.map((sourceY, sourceIndex) => {
      const trapezoidWeight = sourceIndex === 0 || sourceIndex === sourceTotal - 1 ? 0.5 : 1
      const horizontalDistance = Math.max(0.001, point.pointX)
      const verticalDistance = point.pointY - sourceY
      const distance = Math.hypot(horizontalDistance, verticalDistance)
      const obliquity = Math.sqrt(Math.max(0, horizontalDistance / distance))
      const falloff = 1 / Math.sqrt(distance + 0.7)
      const values = timeOffsets.map((timeOffset, sampleIndex) => {
        const amplitude = Math.cos(2 * Math.PI * (distance - phaseCycles - timeOffset)) * obliquity * falloff
        resultant[sampleIndex] += amplitude * trapezoidWeight / weightSum
        return amplitude
      })
      return values.map((amplitude, index) => (
        `${index === 0 ? 'M' : 'L'}${toX(timeOffsets[index]).toFixed(2)},${toY(amplitude).toFixed(2)}`
      )).join(' ')
    })

    const resultantPath = resultant.map((amplitude, index) => (
      `${index === 0 ? 'M' : 'L'}${toX(timeOffsets[index]).toFixed(2)},${toY(amplitude).toFixed(2)}`
    )).join(' ')

    let phasorReal = 0
    let phasorImaginary = 0
    let phasorWeight = 0
    sourceYs.forEach((sourceY, sourceIndex) => {
      const horizontalDistance = Math.max(0.001, point.pointX)
      const verticalDistance = point.pointY - sourceY
      const distance = Math.hypot(horizontalDistance, verticalDistance)
      const obliquity = Math.sqrt(Math.max(0, horizontalDistance / distance))
      const falloff = 1 / Math.sqrt(distance + 0.7)
      const trapezoidWeight = sourceIndex === 0 || sourceIndex === sourceTotal - 1 ? 0.5 : 1
      const amplitudeWeight = obliquity * falloff * trapezoidWeight
      const angle = 2 * Math.PI * (distance - phaseCycles)
      phasorReal += Math.cos(angle) * amplitudeWeight
      phasorImaginary += Math.sin(angle) * amplitudeWeight
      phasorWeight += amplitudeWeight
    })
    const coherence = Math.hypot(phasorReal, phasorImaginary) / phasorWeight
    const interference = coherence >= 0.72
      ? { label: 'Mostly constructive', className: 'constructive' }
      : coherence <= 0.25
        ? { label: 'Mostly destructive', className: 'destructive' }
        : { label: 'Partial interference', className: 'partial' }

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      middleY,
      centreX: toX(0),
      componentPaths,
      resultantPath,
      resultantAtPoint: resultant[Math.floor(sampleTotal / 2)],
      toY,
      halfSpan,
      coherence,
      interference,
    }
  }, [point, phaseCycles])

  const verticalPosition = Math.abs(point.pointY) < 0.05
    ? 'on the centre line'
    : `${formatValue(Math.abs(point.pointY))}λ ${point.pointY < 0 ? 'above' : 'below'} the centre line`

  return (
    <section className="inspector-panel" aria-labelledby="inspector-title">
      <div className="inspector-graph">
        <div className="interference-plot-scroll">
          <svg
            className="interference-plot"
            viewBox={`0 0 ${plot.width} ${plot.height}`}
            role="img"
            aria-label={`One-dimensional time graph at the selected point, centred on now. The sampled waves show ${plot.interference.label.toLowerCase()} interference.`}
          >
            <line className="plot-boundary" x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.bottom} />
            <line className="plot-boundary" x1={plot.right} y1={plot.top} x2={plot.right} y2={plot.bottom} />
            <line className="plot-zero" x1={plot.left} y1={plot.middleY} x2={plot.right} y2={plot.middleY} />
            <line className="plot-selected" x1={plot.centreX} y1={plot.top} x2={plot.centreX} y2={plot.bottom} />
            {plot.componentPaths.map((path, index) => <path className="component-wave" d={path} key={index} />)}
            <path className="combined-wave" d={plot.resultantPath} />
            <circle className="combined-point" cx={plot.centreX} cy={plot.toY(plot.resultantAtPoint)} r="5" />
            <text className="selected-label" x={plot.centreX} y="191" textAnchor="middle">now · t = 0</text>
            <text className="axis-title" x={(plot.left + plot.right) / 2} y="213" textAnchor="middle">time at the selected point</text>
            <text className="amplitude-label" x="18" y={plot.middleY} textAnchor="middle" transform={`rotate(-90 18 ${plot.middleY})`}>instantaneous amplitude</text>
          </svg>
        </div>
      </div>

      <aside className="inspector-details">
        <header className="inspector-header">
          <p className="eyebrow">Point inspector · live at the selected point</p>
          <h2 id="inspector-title">How the wavelets interfere here</h2>
          <p>{formatValue(point.pointX)}λ beyond the aperture · {verticalPosition}</p>
        </header>

        <div className="inspector-status">
          <span className={`interference-state ${plot.interference.className}`}>{plot.interference.label}</span>
          <span>Phase alignment {Math.round(plot.coherence * 100)}%</span>
          <span>{point.sourceCount} sampled contributions</span>
        </div>

        <div className="inspector-actions">
          <button className="inspector-play" type="button" onClick={() => setIsPlaying((value) => !value)}>
            <IconPlay paused={!isPlaying} />
            <span>{isPlaying ? 'Pause graph' : 'Play graph'}</span>
            <strong>{formatValue(playbackSpeed)}×</strong>
          </button>
          <button className="inspector-clear" type="button" onClick={onClose} aria-label="Clear selected point">Clear point</button>
        </div>

        <div className="interference-legend" aria-label="Plot key">
          <span><i className="component-key" />Individual aperture contributions</span>
          <span><i className="resultant-key" />Combined wave</span>
        </div>
      </aside>
    </section>
  )
}

function HuygensExplorer({ onHome }) {
  const [viewMode, setViewMode] = useState('compare')
  const [apertureWidth, setApertureWidth] = useState(1)
  const [wavelengthScale, setWavelengthScale] = useState(1)
  const [sourceCount, setSourceCount] = useState(21)
  const [showWavelets, setShowWavelets] = useState(true)
  const [showResultant, setShowResultant] = useState(true)
  const [paused, setPaused] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [inspectionPoint, setInspectionPoint] = useState(null)

  const ratio = apertureWidth / wavelengthScale
  const aperture = useMemo(() => describeRatio(ratio), [ratio])

  const openInExplorer = (item) => {
    setApertureWidth(item.ratio)
    setWavelengthScale(1)
    setInspectionPoint(null)
    setViewMode('explore')
  }

  return (
    <main className="explorer-page">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={onHome} aria-label="Back to all investigations">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Wave Interference Explorer</span>
        </button>
        <span className="curriculum-tag">Huygens’ wavelets</span>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">See the construction, then see the result</p>
          <h1>How a wave spreads after an aperture</h1>
        </div>
        <p className="intro-copy">
          Every point across the open wavefront can be treated as a source of a secondary wavelet.
          Their <em>superposition</em> determines the transmitted wave—not the number of dots we choose to draw.
        </p>
      </section>

      <section className="lab-shell" aria-label="Interactive diffraction simulation">
        <div className="view-mode-bar">
          <div>
            <span className="control-label">Choose a view</span>
            <div className="view-switcher" role="group" aria-label="Choose simulation view">
              <button
                type="button"
                className={viewMode === 'compare' ? 'active' : ''}
                aria-pressed={viewMode === 'compare'}
                onClick={() => {
                  setInspectionPoint(null)
                  setViewMode('compare')
                }}
              >
                Compare all
              </button>
              <button
                type="button"
                className={viewMode === 'explore' ? 'active' : ''}
                aria-pressed={viewMode === 'explore'}
                onClick={() => setViewMode('explore')}
              >
                Explore variables
              </button>
            </div>
          </div>
          <p>
            {viewMode === 'compare'
              ? 'Three apertures, one wavelength and one shared angular scale.'
              : 'Change aperture width and wavelength independently; the ratio controls the diffraction.'}
          </p>
        </div>

        {viewMode === 'compare' ? (
          <>
            <div className="comparison-toolbar">
              <div>
                <strong>Shared conditions</strong>
                <span>λ = 1 relative unit · shared time scale</span>
              </div>
              <div className="comparison-actions">
                <label htmlFor="compare-speed">
                  <span>Speed</span>
                  <input
                    id="compare-speed"
                    type="range"
                    min="0.25"
                    max="2"
                    step="0.25"
                    value={playbackSpeed}
                    onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                  />
                  <strong>{formatValue(playbackSpeed)}×</strong>
                </label>
                <button className="icon-button" type="button" onClick={() => setPaused((value) => !value)}>
                  <IconPlay paused={paused} />
                  <span>{paused ? 'Play' : 'Pause'}</span>
                </button>
              </div>
            </div>
            <div className="comparison-grid">
              {APERTURES.map((item) => (
                <ComparisonCard
                  key={item.id}
                  item={item}
                  paused={paused}
                  playbackSpeed={playbackSpeed}
                  onExplore={openInExplorer}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="lab-toolbar explore-toolbar">
              <div className="variable-controls">
                <label className="toolbar-slider" htmlFor="aperture-width">
                  <span>Aperture width, a <strong>{formatValue(apertureWidth)} units</strong></span>
                  <input
                    id="aperture-width"
                    type="range"
                    min="1"
                    max="6"
                    step="0.25"
                    value={apertureWidth}
                    onChange={(event) => {
                      setApertureWidth(Number(event.target.value))
                      setInspectionPoint(null)
                    }}
                  />
                </label>
                <label className="toolbar-slider" htmlFor="wavelength-scale">
                  <span>Wavelength, λ <strong>{formatValue(wavelengthScale)} units</strong></span>
                  <input
                    id="wavelength-scale"
                    type="range"
                    min="1"
                    max="4.5"
                    step="0.25"
                    value={wavelengthScale}
                    onChange={(event) => {
                      setWavelengthScale(Number(event.target.value))
                      setInspectionPoint(null)
                    }}
                  />
                </label>
              </div>
              <div className="explore-actions">
                <div className="ratio-readout"><span>Ratio, a/λ</span><strong>{formatValue(ratio)}</strong></div>
                <button className="icon-button" type="button" onClick={() => setPaused((value) => !value)}>
                  <IconPlay paused={paused} />
                  <span>{paused ? 'Play' : 'Pause'}</span>
                </button>
              </div>
            </div>

            <div className={`lab-grid${inspectionPoint ? ' has-inspector' : ''}`}>
              <div className="simulation-panel">
                <WaveCanvas
                  aperture={aperture}
                  apertureWidth={apertureWidth}
                  wavelengthScale={wavelengthScale}
                  measurementLabel={`a = ${formatValue(apertureWidth)}u`}
                  sourceCount={sourceCount}
                  showWavelets={showWavelets}
                  showResultant={showResultant}
                  paused={paused}
                  playbackSpeed={playbackSpeed}
                  inspectionPoint={inspectionPoint}
                  onInspect={setInspectionPoint}
                />
                <div className="canvas-key" aria-label="Simulation key">
                  <span><i className="key-line incident" />Incident wavefronts</span>
                  <span><i className="key-dot" />Sampled sources</span>
                  <span><i className="key-line resultant" />Combined displacement · colour relative to A₀</span>
                </div>
                <div className="inspect-hint">Click anywhere to the right of the aperture to inspect the waves at that point.</div>
              </div>

              <aside className="explanation-panel" aria-live="polite">
                <div className="result-heading">
                  <span className="result-number">{aperture.short}</span>
                  <span className="result-status">{aperture.verdict}</span>
                </div>
                <p className="result-copy">{aperture.description}</p>

                <div className="display-controls">
                  <span className="control-label">Show in the model</span>
                  <label className="switch-row">
                    <span><i className="swatch wavelets" />Secondary wavelets</span>
                    <input
                      type="checkbox"
                      checked={showWavelets}
                      onChange={(event) => setShowWavelets(event.target.checked)}
                    />
                  </label>
                  <label className="switch-row">
                    <span><i className="swatch field" />Combined wave</span>
                    <input
                      type="checkbox"
                      checked={showResultant}
                      onChange={(event) => setShowResultant(event.target.checked)}
                    />
                  </label>
                </div>

                <div className="speed-control slider-control">
                  <label htmlFor="speed">
                    <span>Animation speed</span>
                    <strong>{formatValue(playbackSpeed)}×</strong>
                  </label>
                  <input
                    id="speed"
                    type="range"
                    min="0.25"
                    max="2"
                    step="0.25"
                    value={playbackSpeed}
                    onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                  />
                  <p>Playback only—the wavelength and diffraction pattern stay fixed.</p>
                </div>

                <div className="source-control slider-control">
                  <label htmlFor="sources">
                    <span>Drawn source points</span>
                    <strong>{sourceCount}</strong>
                  </label>
                  <input
                    id="sources"
                    type="range"
                    min="13"
                    max="49"
                    step="4"
                    value={sourceCount}
                    onChange={(event) => {
                      setSourceCount(Number(event.target.value))
                      setInspectionPoint(null)
                    }}
                  />
                  <p>More dots make the Huygens construction denser; the calculated combined field is unchanged.</p>
                </div>
              </aside>
            </div>

            {inspectionPoint && (
              <InterferenceInspector
                point={inspectionPoint}
                onClose={() => setInspectionPoint(null)}
                playbackSpeed={playbackSpeed}
                initiallyPaused={paused}
              />
            )}
          </>
        )}
      </section>

      <section className="principle-section">
        <div className="section-heading">
          <p className="eyebrow">The key idea:</p>
          <h2>What Huygens’ construction is saying</h2>
        </div>
        <ol className="principle-steps">
          <li>
            <span>01</span>
            <div><h3>Start with a wavefront</h3><p>A plane wave reaches the barrier. Only the part inside the aperture continues through.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><h3>Construct secondary wavelets</h3><p>Treat every point across that open wavefront as a coherent source of a circular wavelet.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><h3>Superpose their amplitudes</h3><p>Reinforcement and cancellation produce the diffracted wave. The new wavefront follows equal phase.</p></div>
          </li>
        </ol>
      </section>

      <section className="exam-note">
        <div className="note-marker" aria-hidden="true">λ ≈ a</div>
        <div>
          <p className="eyebrow">Exam-ready statement</p>
          <h2>Diffraction is most significant when the wavelength is comparable to the aperture width.</h2>
          <p>For a fixed wavelength, a narrower aperture produces greater angular spreading. If the aperture is much narrower than λ, the transmitted wave is very weak.</p>
        </div>
      </section>

    </main>
  )
}

function sinc(value) {
  return Math.abs(value) < 1e-8 ? 1 : Math.sin(value) / value
}

function pathDifferenceAtAngle(config, theta) {
  if (config.kind !== 'double-slit') return config.spacing * Math.sin(theta)

  const screenY = config.screenDistance * Math.tan(theta)
  const halfSeparation = config.spacing / 2
  const distanceFromLowerSlit = Math.hypot(config.screenDistance, screenY + halfSeparation)
  const distanceFromUpperSlit = Math.hypot(config.screenDistance, screenY - halfSeparation)
  return distanceFromLowerSlit - distanceFromUpperSlit
}

function doubleSlitLocusY(config, pathDifference, x) {
  if (Math.abs(pathDifference) < 1e-8) return 0

  const focusDistance = config.spacing / 2
  const semiMajorAxis = Math.abs(pathDifference) / 2
  if (semiMajorAxis >= focusDistance) return null

  const semiMinorSquared = focusDistance * focusDistance - semiMajorAxis * semiMajorAxis
  return Math.sign(pathDifference) * semiMajorAxis * Math.sqrt(1 + (x * x) / semiMinorSquared)
}

function interferenceIntensity(config, theta) {
  const phase = Math.PI * pathDifferenceAtAngle(config, theta) / config.wavelength
  const denominator = Math.sin(phase)
  const arrayAmplitude = Math.abs(denominator) < 1e-8
    ? 1
    : Math.sin(config.sourceCount * phase) / (config.sourceCount * denominator)
  const effectiveSlitWidth = config.kind === 'double-slit'
    ? config.slitWidth
    : Math.min(0.45, config.spacing * 0.3)
  const envelopeAmplitude = sinc(Math.PI * effectiveSlitWidth * Math.sin(theta) / config.wavelength)
  return Math.min(1, Math.max(0, arrayAmplitude * arrayAmplitude * envelopeAmplitude * envelopeAmplitude))
}

function wavelengthColour(wavelengthNm) {
  const hue = 270 - ((wavelengthNm - 400) / 300) * 270
  return "hsl(" + Math.round(clamp(hue, 0, 270)) + " 90% 68%)"
}

function laserColourForWavelength(wavelengthNm) {
  if (wavelengthNm > 700) return [255, 62, 145]

  const colourStops = [
    [380, [118, 72, 255]],
    [400, [139, 105, 255]],
    [450, [83, 128, 255]],
    [485, [54, 220, 255]],
    [520, [72, 255, 151]],
    [565, [218, 255, 82]],
    [590, [255, 211, 67]],
    [625, [255, 105, 65]],
    [700, [255, 50, 45]],
  ]
  const clampedWavelength = clamp(wavelengthNm, colourStops[0][0], colourStops.at(-1)[0])
  const upperIndex = colourStops.findIndex(([wavelength]) => wavelength >= clampedWavelength)
  const upper = colourStops[Math.max(1, upperIndex)]
  const lower = colourStops[Math.max(0, upperIndex - 1)]
  const mix = (clampedWavelength - lower[0]) / (upper[0] - lower[0])
  return lower[1].map((channel, index) => Math.round(channel + (upper[1][index] - channel) * mix))
}

function formatAngle(theta) {
  return formatValue(theta * 180 / Math.PI) + "°"
}

function RangeControl({ id, label, value, min, max, step, unit, displayValue = null, onChange, disabled = false }) {
  return (
    <label className={"investigation-control" + (disabled ? " disabled" : "")} htmlFor={id}>
      <span>{label}<strong>{displayValue ?? formatValue(value)}{unit}</strong></span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

const DEFAULT_APPARATUS_YAW = 0.46
const DEFAULT_APPARATUS_PITCH = 0.2

function GratingApparatus3D({ config, selectedOrder, onSelectOrder, paused, playbackSpeed }) {
  const canvasRef = useRef(null)
  const drawRef = useRef(null)
  const yawRef = useRef(DEFAULT_APPARATUS_YAW)
  const pitchRef = useRef(DEFAULT_APPARATUS_PITCH)
  const phaseRef = useRef(0)
  const dragRef = useRef(null)
  const screenHotspotsRef = useRef([])
  const maximumOrder = Math.floor(config.spacing / config.wavelength)
  const orders = useMemo(() => (
    Array.from({ length: maximumOrder * 2 + 1 }, (_, index) => index - maximumOrder)
  ), [maximumOrder])
  const activeOrder = clamp(selectedOrder, -maximumOrder, maximumOrder)
  const activeTheta = Math.asin(activeOrder * config.wavelength / config.spacing)
  const activeScreenPosition = config.screenDistance * Math.tan(activeTheta)
  const orderOnScreen = Math.abs(activeScreenPosition) <= config.screenHalfHeight

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frameId
    let previous = performance.now()

    const draw = (now = performance.now(), advancePhase = true) => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(320, rect.width)
      const height = Math.max(330, rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.round(width * dpr)
      const pixelHeight = Math.round(height * dpr)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (advancePhase && !paused && !reducedMotion) {
        const elapsed = Math.min(50, now - previous)
        phaseRef.current = (phaseRef.current + elapsed * 0.00042 * playbackSpeed / config.wavelength) % 1
      }
      previous = now

      const background = context.createLinearGradient(0, 0, width, height)
      background.addColorStop(0, '#050f18')
      background.addColorStop(0.54, '#0a2230')
      background.addColorStop(1, '#06131e')
      context.fillStyle = background
      context.fillRect(0, 0, width, height)

      const yaw = yawRef.current
      const pitch = pitchRef.current
      const cosineYaw = Math.cos(yaw)
      const sineYaw = Math.sin(yaw)
      const cosinePitch = Math.cos(pitch)
      const sinePitch = Math.sin(pitch)
      const diagramMicroScale = 0.5
      const targetX = (config.screenDistance - 5.5) / 2
      const apparatusHalfWidth = Math.max(config.screenHalfHeight, 2.45)
      const scale = Math.min(
        width / (config.screenDistance + 15),
        height / Math.max(15.5, apparatusHalfWidth * 1.45),
      ) * 0.98 * 0.9

      const project = ([x, y, z]) => {
        const dx = x - targetX
        const rotatedX = dx * cosineYaw - y * sineYaw
        const rotatedY = dx * sineYaw + y * cosineYaw
        const liftedY = rotatedY * cosinePitch - z * sinePitch
        const liftedZ = rotatedY * sinePitch + z * cosinePitch
        const perspective = clamp(1 - liftedY * 0.012, 0.78, 1.2)
        return {
          x: width * 0.45 + rotatedX * scale * perspective,
          y: height * 0.51 - liftedZ * scale * perspective,
          depth: liftedY,
        }
      }

      const strokeLine = (points, colour, lineWidth = 1, dash = []) => {
        if (points.length < 2) return
        context.save()
        context.strokeStyle = colour
        context.lineWidth = lineWidth
        context.setLineDash(dash)
        context.beginPath()
        points.forEach((point, index) => {
          const projected = project(point)
          if (index === 0) context.moveTo(projected.x, projected.y)
          else context.lineTo(projected.x, projected.y)
        })
        context.stroke()
        context.restore()
      }

      const fillFace = (points, fill, stroke = null, lineWidth = 1) => {
        context.save()
        context.fillStyle = fill
        context.beginPath()
        points.forEach((point, index) => {
          const projected = project(point)
          if (index === 0) context.moveTo(projected.x, projected.y)
          else context.lineTo(projected.x, projected.y)
        })
        context.closePath()
        context.fill()
        if (stroke) {
          context.strokeStyle = stroke
          context.lineWidth = lineWidth
          context.stroke()
        }
        context.restore()
      }

      const label = (point, textValue, colour = '#9bb4be', align = 'center', size = 11) => {
        const projected = project(point)
        context.save()
        context.fillStyle = colour
        context.font = '600 ' + size + 'px DM Sans, sans-serif'
        context.textAlign = align
        context.textBaseline = 'middle'
        context.fillText(textValue, projected.x, projected.y)
        context.restore()
      }

      const wavelengthNm = config.wavelength * 1000
      const laserRgb = laserColourForWavelength(wavelengthNm)
      const laserColour = `rgb(${laserRgb.join(', ')})`
      const laserColourWithAlpha = (alpha) => `rgba(${laserRgb.join(', ')}, ${alpha})`

      const floorZ = -4.5
      fillFace(
        [[-5.5, -config.screenHalfHeight, floorZ], [config.screenDistance, -config.screenHalfHeight, floorZ], [config.screenDistance, config.screenHalfHeight, floorZ], [-5.5, config.screenHalfHeight, floorZ]],
        'rgba(23, 74, 81, 0.36)',
      )
      for (let x = -5; x <= config.screenDistance; x += 2.5) {
        strokeLine([[x, -config.screenHalfHeight, floorZ], [x, config.screenHalfHeight, floorZ]], 'rgba(126, 181, 199, 0.07)')
      }
      for (let y = -config.screenHalfHeight; y <= config.screenHalfHeight; y += 2.3) {
        strokeLine([[-5.5, y, floorZ], [config.screenDistance, y, floorZ]], 'rgba(126, 181, 199, 0.07)')
      }

      const screenX = config.screenDistance
      const observationHalfWidth = config.screenHalfHeight
      const screenPlateHalfWidth = observationHalfWidth * 2 * 0.6
      const screenHalfHeight3D = 4.35
  fillFace(
    [[screenX, -screenPlateHalfWidth, -screenHalfHeight3D], [screenX, screenPlateHalfWidth, -screenHalfHeight3D], [screenX, screenPlateHalfWidth, screenHalfHeight3D], [screenX, -screenPlateHalfWidth, screenHalfHeight3D]],
    'rgba(232, 240, 244, 0.24)',
    'rgba(248, 252, 255, 0.84)',
    1.3,
  )

      const screenSampleCount = 1001
      for (let index = 0; index < screenSampleCount; index += 1) {
        const screenY = -observationHalfWidth + (index / (screenSampleCount - 1)) * observationHalfWidth * 2
        const theta = Math.atan(screenY / config.screenDistance)
        const intensity = interferenceIntensity(config, theta)
        if (intensity < 0.006) continue
        const point = project([screenX + 0.03, screenY, 0])
        const radius = 1.2 + Math.pow(intensity, 0.45) * 5.2
        const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.1)
        glow.addColorStop(0, laserColourWithAlpha(0.2 + intensity * 0.8))
        glow.addColorStop(0.35, laserColourWithAlpha(intensity * 0.58))
        glow.addColorStop(1, laserColourWithAlpha(0))
        context.fillStyle = glow
        context.beginPath()
        context.arc(point.x, point.y, radius * 2.1, 0, Math.PI * 2)
        context.fill()
      }
      label([screenX, 0, screenHalfHeight3D + 0.7], 'SCREEN · CENTRAL ±' + formatValue(config.screenHalfHeight) + ' cm OBSERVATION RANGE', '#aac3cc', 'center', 9)

      const gratingHalfWidth = 2.45
      const gratingHalfHeight = 1.85
  fillFace(
    [[0, -gratingHalfWidth, -gratingHalfHeight], [0, gratingHalfWidth, -gratingHalfHeight], [0, gratingHalfWidth, gratingHalfHeight], [0, -gratingHalfWidth, gratingHalfHeight]],
    'rgba(52, 70, 137, 0.52)',
    'rgba(132, 162, 248, 0.9)',
    1.4,
  )

      const rulingCount = 61
      for (let index = 0; index < rulingCount; index += 1) {
        const rulingY = -gratingHalfWidth + 0.16 + (index / (rulingCount - 1)) * (gratingHalfWidth * 2 - 0.32)
        const centreBias = 1 - Math.abs((index / (rulingCount - 1)) * 2 - 1)
      strokeLine(
        [[0.035, rulingY, -gratingHalfHeight + 0.16], [0.035, rulingY, gratingHalfHeight - 0.16]],
        `rgba(196, 213, 255, ${0.22 + centreBias * 0.34})`,
        0.58,
      )
      }
      const laserPoint = [-5.4, 0, 0]
      const laserProjected = project(laserPoint)
      const laserGlow = context.createRadialGradient(laserProjected.x, laserProjected.y, 0, laserProjected.x, laserProjected.y, 15)
      laserGlow.addColorStop(0, laserColourWithAlpha(0.95))
      laserGlow.addColorStop(0.24, laserColourWithAlpha(0.48))
      laserGlow.addColorStop(1, laserColourWithAlpha(0))
      context.fillStyle = laserGlow
      context.beginPath()
      context.arc(laserProjected.x, laserProjected.y, 15, 0, Math.PI * 2)
      context.fill()
      strokeLine([[-5.25, 0, 0], [0, 0, 0]], laserColour, 2.5)
      strokeLine([[-5.25, -0.3, -0.3], [0, -0.3, -0.3]], laserColourWithAlpha(0.3), 1)
      strokeLine([[-5.25, 0.3, 0.3], [0, 0.3, 0.3]], laserColourWithAlpha(0.3), 1)
      label([-5.45, 0, 0.72], 'LASER · λ = ' + Math.round(wavelengthNm) + ' nm' + (wavelengthNm > 700 ? ' · IR FALSE COLOUR' : ''), laserColour, 'center', 9)

  const displayedWavelength = Math.max(0.55, config.wavelength)
  const incidentSpacing = displayedWavelength
  const incidentOffset = phaseRef.current * incidentSpacing
  const incidentHalfWidth = 2.35 * 0.5
  const incidentHalfHeight = 1.55 * 0.5
  for (let x = -4.8 + incidentOffset; x < -0.15; x += incidentSpacing) {
    strokeLine([[x, -incidentHalfWidth, -incidentHalfHeight], [x, -incidentHalfWidth, incidentHalfHeight], [x, incidentHalfWidth, incidentHalfHeight], [x, incidentHalfWidth, -incidentHalfHeight], [x, -incidentHalfWidth, -incidentHalfHeight]], laserColourWithAlpha(0.28), 0.9)
      }

      strokeLine([[0.12, 0, 0], [Math.min(7.5, config.screenDistance), 0, 0]], 'rgba(191, 224, 233, 0.28)', 1, [3, 4])

      const nextScreenHotspots = []
      orders.forEach((order) => {
        const theta = Math.asin(order * config.wavelength / config.spacing)
        const tangent = Math.tan(theta)
        const reachesScreen = Math.abs(tangent * config.screenDistance) <= observationHalfWidth
        const endX = reachesScreen || Math.abs(tangent) < 1e-7
          ? config.screenDistance
          : Math.min(config.screenDistance, observationHalfWidth / Math.abs(tangent))
        const endY = endX * tangent
        const isActive = order === activeOrder
        const rayColour = isActive ? laserColour : laserColourWithAlpha(0.43)
        if (isActive) {
          strokeLine([[0.18, 0, 0], [endX, endY, 0]], laserColourWithAlpha(0.18), 5.5)
        }
        strokeLine([[0.18, 0, 0], [endX, endY, 0]], rayColour, isActive ? 2.7 : 1.15, isActive ? [] : [4, 4])
        if (reachesScreen) {
          const orderPoint = project([config.screenDistance + 0.08, endY, 0])
          nextScreenHotspots.push({ order, x: orderPoint.x, y: orderPoint.y })
          context.save()
          context.fillStyle = isActive ? laserColour : laserColourWithAlpha(0.8)
          context.beginPath()
          context.arc(orderPoint.x, orderPoint.y, isActive ? 5 : 3, 0, Math.PI * 2)
          context.fill()
          context.font = '700 8px DM Sans, sans-serif'
          context.textAlign = 'center'
          context.fillStyle = isActive ? '#ffd477' : 'rgba(179, 224, 234, 0.74)'
          context.fillText(order === 0 ? '0' : (order > 0 ? '+' : '−') + Math.abs(order), orderPoint.x, orderPoint.y - 10)
          context.restore()
        }
        if (isActive) {
          label([Math.min(endX, 7.8), Math.min(endX, 7.8) * tangent, 0.58], 'n = ' + (order > 0 ? '+' : '') + order, '#ffd477', 'center', 10)
        }
      })
      screenHotspotsRef.current = nextScreenHotspots

      const direction = [Math.cos(activeTheta), Math.sin(activeTheta), 0]
      const across = [-Math.sin(activeTheta), Math.cos(activeTheta), 0]
      const selectedEndX = orderOnScreen || Math.abs(Math.tan(activeTheta)) < 1e-7
        ? config.screenDistance
        : Math.min(config.screenDistance, observationHalfWidth / Math.abs(Math.tan(activeTheta)))
      const selectedLength = selectedEndX / Math.max(0.01, direction[0])

      if (activeOrder !== 0) {
        const arcRadius = 2.15
        const arcPoints = Array.from({ length: 25 }, (_, index) => {
          const arcAngle = activeTheta * index / 24
          return [arcRadius * Math.cos(arcAngle), arcRadius * Math.sin(arcAngle), 0]
        })
        strokeLine(arcPoints, '#ffd477', 1.35)
        label(
          [arcRadius * Math.cos(activeTheta / 2), arcRadius * Math.sin(activeTheta / 2), 0.35],
          'θ = ' + formatAngle(activeTheta),
          '#ffd477',
          'center',
          9,
        )

        const sign = Math.sign(activeTheta)
        const lowerSource = [0.06, -sign * config.spacing * diagramMicroScale / 2, -0.35]
        const upperSource = [0.06, sign * config.spacing * diagramMicroScale / 2, -0.35]
        const pathDifference = config.spacing * diagramMicroScale * Math.abs(Math.sin(activeTheta))
        const phaseFoot = [
          lowerSource[0] + direction[0] * pathDifference,
          lowerSource[1] + direction[1] * pathDifference,
          lowerSource[2],
        ]
        strokeLine([lowerSource, [lowerSource[0] + direction[0] * Math.min(selectedLength, 5.2), lowerSource[1] + direction[1] * Math.min(selectedLength, 5.2), lowerSource[2]]], laserColourWithAlpha(0.78), 1.25)
        strokeLine([upperSource, [upperSource[0] + direction[0] * Math.min(selectedLength, 5.2), upperSource[1] + direction[1] * Math.min(selectedLength, 5.2), upperSource[2]]], laserColourWithAlpha(0.78), 1.25)
        strokeLine([lowerSource, upperSource], 'rgba(185, 222, 232, 0.42)', 1)
        strokeLine([lowerSource, phaseFoot], '#ffad70', 2.2)
        strokeLine([phaseFoot, upperSource], 'rgba(102, 221, 243, 0.8)', 1.25, [3, 3])
        label(
          [(lowerSource[0] + phaseFoot[0]) / 2, (lowerSource[1] + phaseFoot[1]) / 2, lowerSource[2] + 0.32],
          'Δ = ' + Math.abs(activeOrder) + 'λ',
          '#ffad70',
          'center',
          9,
        )
      }

      const wavefrontSpacing = displayedWavelength
      const movingOffset = phaseRef.current * wavefrontSpacing
      for (let distance = 1.3 + movingOffset; distance < selectedLength - 0.5; distance += wavefrontSpacing) {
        const centre = [direction[0] * distance, direction[1] * distance, 0]
      const halfAcross = 2.45 * 0.5
      const halfVertical = 2.25 * 0.5
        const corner = (acrossScale, verticalScale) => [
          centre[0] + across[0] * acrossScale,
          centre[1] + across[1] * acrossScale,
          verticalScale,
        ]
        fillFace(
          [corner(-halfAcross, -halfVertical), corner(halfAcross, -halfVertical), corner(halfAcross, halfVertical), corner(-halfAcross, halfVertical)],
          laserColourWithAlpha(0.055),
          laserColourWithAlpha(0.46),
          1.05,
        )
      }

      if (activeOrder !== 0) {
        const markerX = Math.min(config.screenDistance * 0.38, 6)
        const markerY = markerX * Math.tan(activeTheta)
        strokeLine([[markerX, 0, floorZ + 0.2], [markerX, markerY, floorZ + 0.2]], 'rgba(255, 212, 119, 0.62)', 1)
      }

      label([config.screenDistance * 0.5, -observationHalfWidth - 0.35, floorZ], 'D = ' + formatValue(config.screenDistance) + ' cm', '#7897a3', 'center', 9)
    }

    drawRef.current = draw
    const resizeObserver = new ResizeObserver(() => draw(performance.now(), false))
    resizeObserver.observe(canvas)

    const animate = (now) => {
      draw(now, true)
      if (!paused && !reducedMotion) frameId = requestAnimationFrame(animate)
    }
    draw(performance.now(), false)
    if (!paused && !reducedMotion) frameId = requestAnimationFrame(animate)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(frameId)
      drawRef.current = null
    }
  }, [config, orders, activeOrder, activeTheta, orderOnScreen, paused, playbackSpeed])

  const beginRotate = (event) => {
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const rotate = (event) => {
    if (!dragRef.current) return
    const movementX = event.clientX - dragRef.current.x
    const movementY = event.clientY - dragRef.current.y
    const moved = dragRef.current.moved
      || Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY) > 5
    dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY, moved }
    yawRef.current += movementX * 0.008
    pitchRef.current = clamp(pitchRef.current + movementY * 0.006, 0, 0.62)
    drawRef.current?.(performance.now(), false)
  }

  const finishRotate = (event) => {
    const drag = dragRef.current
    if (drag && !drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const nearest = screenHotspotsRef.current
        .map((hotspot) => ({ ...hotspot, distance: Math.hypot(pointerX - hotspot.x, pointerY - hotspot.y) }))
        .sort((a, b) => a.distance - b.distance)[0]
      if (nearest && nearest.distance <= 16) onSelectOrder(nearest.order)
    }
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const resetView = () => {
    yawRef.current = DEFAULT_APPARATUS_YAW
    pitchRef.current = DEFAULT_APPARATUS_PITCH
    drawRef.current?.(performance.now(), false)
  }

  return (
    <div className="grating-3d-wrap">
      <canvas
        ref={canvasRef}
        className="grating-3d-canvas"
        role="img"
        aria-label="Rotatable schematic three-dimensional diffraction grating apparatus showing a laser, a dense grating with one hundred illuminated lines, principal-order rays, aligned wavefronts and a wide observation screen. Wavelength, spacing and screen distance are shared with the other views. Click a labelled screen maximum to select its order."
        onPointerDown={beginRotate}
        onPointerMove={rotate}
        onPointerUp={finishRotate}
        onPointerCancel={finishRotate}
      />
      <div className="grating-3d-heading">
        <strong>Experimental arrangement · schematic</strong>
        <span>λ, d and D shared · N fixed at 100 · component sizes not to scale</span>
        <span>Drag to rotate · click a screen maximum to select it</span>
      </div>
      <button className="grating-reset-view" type="button" onClick={resetView}>Reset view</button>
      <div className="grating-order-status">
        <span>Selected order</span>
        <strong>n = {activeOrder > 0 ? '+' : ''}{activeOrder}</strong>
        <span>θ = {formatAngle(activeTheta)}</span>
        <span>d sin θ = nλ</span>
        {orderOnScreen && <span>screen position</span>}
        {orderOnScreen && <strong>{formatValue(activeScreenPosition)} cm</strong>}
        {!orderOnScreen && <em>Beyond this screen’s edge</em>}
      </div>
      <div className="grating-order-picker" role="group" aria-label="Select a principal diffraction order">
        <span>Principal order</span>
        <div>
          {orders.map((order) => (
            <button
              key={order}
              className={order === activeOrder ? 'active' : ''}
              type="button"
              onClick={() => onSelectOrder(order)}
              aria-pressed={order === activeOrder}
            >
              {order > 0 ? '+' + order : order}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LegacyMultiSlitField({ config, selectedAngle, onSelect, paused, playbackSpeed }) {
  const [phase, setPhase] = useState(0)
  const fieldRef = useRef(null)
  const width = 900
  const height = 430
  const barrierX = 164
  const centreY = height / 2
  const metresToPixels = 210
  const screenX = barrierX + config.screenDistanceM * metresToPixels
  const screenHalfHeightM = config.kind === 'double-slit' ? 0.12 : 0.75
  const screenTop = centreY - screenHalfHeightM * metresToPixels
  const screenBottom = centreY + screenHalfHeightM * metresToPixels
  const screenHeight = screenBottom - screenTop
  const visualWavelength = 31 + ((config.wavelengthNm - 400) / 300) * 29
  const frontCount = Math.ceil((barrierX - 12) / visualWavelength) + 1
  const maximumRadius = Math.max(180, width - barrierX)
  const ringCount = Math.ceil(maximumRadius / visualWavelength) + 1

  useEffect(() => {
    if (paused) return undefined
    let frameId
    let previous = performance.now()
    const advance = (now) => {
      const elapsed = Math.min(60, now - previous)
      previous = now
      setPhase((value) => (value + elapsed * 0.00065 * playbackSpeed * (550 / config.wavelengthNm)) % 1)
      frameId = requestAnimationFrame(advance)
    }
    frameId = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frameId)
  }, [paused, playbackSpeed, config.wavelengthNm])

  const choosePoint = (event) => {
    const rect = fieldRef.current.getBoundingClientRect()
    const viewRatio = width / height
    const elementRatio = rect.width / rect.height
    const renderedWidth = elementRatio > viewRatio ? rect.height * viewRatio : rect.width
    const renderedHeight = elementRatio > viewRatio ? rect.height : rect.width / viewRatio
    const offsetX = (rect.width - renderedWidth) / 2
    const offsetY = (rect.height - renderedHeight) / 2
    const localX = event.clientX - rect.left - offsetX
    const localY = event.clientY - rect.top - offsetY
    if (localX < 0 || localX > renderedWidth || localY < 0 || localY > renderedHeight) return
    const x = (localX / renderedWidth) * width
    const y = (localY / renderedHeight) * height
    if (x <= barrierX + 10) return
    const horizontalDistanceM = (x - barrierX) / metresToPixels
    const verticalDistanceM = (centreY - y) / metresToPixels
    onSelect(Math.atan2(verticalDistanceM, horizontalDistanceM))
  }

  const selectedScreenY = selectedAngle == null
    ? null
    : centreY - config.screenDistanceM * Math.tan(selectedAngle) * metresToPixels
  const bandCount = config.kind === 'double-slit' ? 220 : 260
  const screenBands = Array.from({ length: bandCount }, (_, index) => {
    const y = screenTop + (index / (bandCount - 1)) * screenHeight
    const screenPositionM = (centreY - y) / metresToPixels
    const angle = Math.atan(screenPositionM / config.screenDistanceM)
    return { y, intensity: interferenceIntensity(config, angle) }
  })
  const rulerStepM = 0.5
  const rulerTicks = Array.from(
    { length: Math.floor(config.screenDistanceM / rulerStepM) + 1 },
    (_, index) => Math.min(index * rulerStepM, config.screenDistanceM),
  )
  if (rulerTicks[rulerTicks.length - 1] !== config.screenDistanceM) rulerTicks.push(config.screenDistanceM)
  const doubleSlit = config.kind === 'double-slit'
  const insetX = 18
  const insetY = 18
  const insetWidth = 218
  const insetHeight = 112
  const insetBarrierX = insetX + 84
  const insetCentreY = insetY + 61
  const doubleScale = 72 / 1.2
  const slitSeparationPx = config.spacingM * 1000 * doubleScale
  const slitWidthPx = config.slitWidthM * 1000 * doubleScale
  const gratingDetailHeightM = Math.max(20e-6, config.spacingM * (config.sourceCount - 1) * 1.15)
  const gratingScale = 84 / gratingDetailHeightM
  const gratingSpacingPx = config.spacingM * gratingScale
  const gratingYs = Array.from({ length: config.sourceCount }, (_, index) => (
    insetCentreY + (index - (config.sourceCount - 1) / 2) * gratingSpacingPx
  ))

  return (
    <div className="multi-field-wrap">
      <svg
        ref={fieldRef}
        className="multi-field"
        viewBox={"0 0 " + width + " " + height}
        role="img"
        aria-label={"Scale apparatus diagram with enlarged wavefront spacing and a magnified view of " + (config.kind === 'double-slit' ? "two slits" : config.sourceCount + " grating slits")}
        onClick={choosePoint}
        style={{ '--wave-colour': wavelengthColour(config.wavelengthNm) }}
      >
        <defs>
          <linearGradient id={"field-bg-" + config.kind} x1="0" x2="1">
            <stop offset="0" stopColor="#06121c" />
            <stop offset="0.48" stopColor="#0a2130" />
            <stop offset="1" stopColor="#071823" />
          </linearGradient>
          <clipPath id={"forward-field-" + config.kind}>
            <rect x={barrierX + 4} y="0" width={Math.max(0, screenX - barrierX - 5)} height={height} />
          </clipPath>
        </defs>
        <rect width={width} height={height} fill={"url(#field-bg-" + config.kind + ")"} />
        <g className="field-grid">
          {Array.from({ length: 12 }, (_, index) => <line key={"v" + index} x1={index * 82} y1="0" x2={index * 82} y2={height} />)}
          {Array.from({ length: 7 }, (_, index) => <line key={"h" + index} x1="0" y1={index * 72} x2={width} y2={index * 72} />)}
        </g>

        <g className="incident-fronts">
          {Array.from({ length: frontCount }, (_, index) => {
            const travel = phase * visualWavelength
            let x = barrierX - 8 - index * visualWavelength + travel
            if (x > barrierX - 8) x -= frontCount * visualWavelength
            return <line key={index} x1={x} y1="25" x2={x} y2={height - 54} />
          })}
        </g>

        <g className="wave-direction">
          <line x1="42" y1="151" x2={barrierX - 25} y2="151" />
          <path d={"M" + (barrierX - 25) + " 151l-9-5v10Z"} />
          <text x="42" y="143">propagation</text>
        </g>

        <line className="apparatus-barrier" x1={barrierX} y1="168" x2={barrierX} y2="263" />
        <circle className="unresolved-slits" cx={barrierX} cy={centreY} r="3" />
        <text className="apparatus-label" x={barrierX} y="280" textAnchor="middle">aperture</text>

        <g clipPath={"url(#forward-field-" + config.kind + ")"} className="composite-fronts">
          {Array.from({ length: ringCount }, (_, ringIndex) => {
            const radius = 14 + ((ringIndex * visualWavelength + phase * visualWavelength) % maximumRadius)
            return <circle key={ringIndex} cx={barrierX} cy={centreY} r={radius} />
          })}
        </g>

        <g className="observation-screen">
          <line x1={screenX} y1={screenTop} x2={screenX} y2={screenBottom} />
          {screenBands.map((band, index) => (
            <rect
              key={index}
              x={screenX + 5}
              y={band.y - screenHeight / bandCount / 2}
              width={4 + band.intensity * 26}
              height={screenHeight / bandCount + 0.35}
              style={{ opacity: 0.08 + band.intensity * 0.92 }}
            />
          ))}
          <text className="apparatus-label" x={screenX} y={screenBottom + 16} textAnchor="middle">
            screen · {formatValue(screenHalfHeightM * 2)} m high
          </text>
        </g>

        {selectedScreenY != null && selectedScreenY >= screenTop - 2 && selectedScreenY <= screenBottom + 2 && (
          <g className="field-selection">
            <line x1={barrierX + 3} y1={centreY} x2={screenX} y2={selectedScreenY} />
            <circle cx={screenX} cy={selectedScreenY} r="7" />
            <text x={screenX - 12} y={selectedScreenY - 11} textAnchor="end">{formatAngle(selectedAngle)}</text>
          </g>
        )}

        <g className="scale-ruler">
          <line x1={barrierX} y1="365" x2={screenX} y2="365" />
          {rulerTicks.map((distance, index) => {
            const tickX = barrierX + distance * metresToPixels
            return (
              <g key={index}>
                <line x1={tickX} y1="359" x2={tickX} y2="371" />
                <text x={tickX} y="387" textAnchor="middle">{formatValue(distance)} m</text>
              </g>
            )
          })}
          <text x={(barrierX + screenX) / 2} y="353" textAnchor="middle">D = {formatValue(config.screenDistanceM)} m</text>
        </g>

        <g className="aperture-inset">
          <rect x={insetX} y={insetY} width={insetWidth} height={insetHeight} rx="5" />
          <text className="inset-title" x={insetX + 11} y={insetY + 17}>
            {doubleSlit ? "APERTURE DETAIL · 1.2 mm HIGH" : "GRATING DETAIL · " + formatValue(gratingDetailHeightM * 1e6) + " μm HIGH"}
          </text>
          <line className="inset-barrier" x1={insetBarrierX} y1={insetY + 25} x2={insetBarrierX} y2={insetY + insetHeight - 9} />
          {doubleSlit ? (
            <>
              {[insetCentreY - slitSeparationPx / 2, insetCentreY + slitSeparationPx / 2].map((slitY, index) => (
                <g key={index}>
                  <line className="inset-opening" x1={insetBarrierX} y1={slitY - Math.max(1, slitWidthPx / 2)} x2={insetBarrierX} y2={slitY + Math.max(1, slitWidthPx / 2)} />
                  <circle className="inset-source" cx={insetBarrierX + 3} cy={slitY} r="2.5" />
                </g>
              ))}
              <g className="inset-dimension">
                <line x1={insetBarrierX + 38} y1={insetCentreY - slitSeparationPx / 2} x2={insetBarrierX + 38} y2={insetCentreY + slitSeparationPx / 2} />
                <path d={"M" + (insetBarrierX + 34) + " " + (insetCentreY - slitSeparationPx / 2 + 5) + "l4-5 4 5M" + (insetBarrierX + 34) + " " + (insetCentreY + slitSeparationPx / 2 - 5) + "l4 5 4-5"} />
                <text x={insetBarrierX + 46} y={insetCentreY + 3}>d = {formatValue(config.spacingM * 1000)} mm</text>
                <text x={insetBarrierX + 46} y={insetCentreY + 20}>a = {formatValue(config.slitWidthM * 1000)} mm</text>
              </g>
            </>
          ) : (
            <>
              {gratingYs.map((slitY, index) => (
                <line className="inset-opening grating-opening" key={index} x1={insetBarrierX} y1={slitY - 0.7} x2={insetBarrierX} y2={slitY + 0.7} />
              ))}
              <g className="inset-dimension">
                <text x={insetBarrierX + 20} y={insetY + 47}>d = {formatValue(config.spacingM * 1e6)} μm</text>
                <text x={insetBarrierX + 20} y={insetY + 65}>N = {config.sourceCount}</text>
                <text x={insetBarrierX + 20} y={insetY + 83}>{formatValue(1 / (config.spacingM * 1000))} lines mm⁻¹</text>
              </g>
            </>
          )}
          <path className="inset-connector" d={"M" + (insetX + insetWidth - 8) + " " + (insetY + insetHeight) + "L" + barrierX + " " + (centreY - 7)} />
        </g>

        <text className="field-caption" x="21" y="414">APPARATUS SCALE · 0.5 m DIVISIONS</text>
        <text className="field-caption wavefront-note" x="310" y="414">WAVEFRONT SPACING ENLARGED · λ CONTROLS SPACING AND FREQUENCY</text>
      </svg>
      <span className="field-scale-note">Main geometry uses one metre scale · aperture enlarged because it is sub-pixel here</span>
    </div>
  )
}

function PathDifferenceField({ config, selectedAngle, onSelect, paused, playbackSpeed, stepSignal = 0, stepFrameCount = 4, showFringeGeometry = false, onToggleFringeGeometry }) {
  const svgRef = useRef(null)
  const draggingRef = useRef(false)
  const readoutDragRef = useRef(null)
  const geometryDragRef = useRef(null)
  const lastStepSignalRef = useRef(stepSignal)
  const [phase, setPhase] = useState(0)
  const [readoutOffset, setReadoutOffset] = useState({ x: 0, y: 0 })
  const [geometryOffset, setGeometryOffset] = useState({ x: 0, y: 0 })
  const width = 900
  const height = 510
  const barrierX = 112
  const centreY = height / 2
  const spatialScale = 25
  const screenX = barrierX + config.screenDistance * spatialScale
  const verticalScale = spatialScale
  const screenTop = centreY - config.screenHalfHeight * spatialScale
  const screenBottom = centreY + config.screenHalfHeight * spatialScale
  const maximumAngle = Math.atan(config.screenHalfHeight / config.screenDistance)
  const angle = clamp(selectedAngle ?? 0, -maximumAngle, maximumAngle)
  const screenY = config.screenDistance * Math.tan(angle)
  const target = { x: screenX, y: centreY - screenY * verticalScale }
  const apertureHalfHeight = Math.max(7, config.slitWidth * verticalScale / 2)
  const sourceWorldYs = [config.spacing / 2, -config.spacing / 2]
  const sources = sourceWorldYs.map((worldY, index) => {
    const point = { x: barrierX, y: centreY - worldY * verticalScale }
    const physicalLength = Math.hypot(config.screenDistance, screenY - worldY)
    const dx = target.x - point.x
    const dy = target.y - point.y
    const displayLength = Math.hypot(dx, dy)
    return {
      index,
      worldY,
      point,
      physicalLength,
      dx,
      dy,
      displayLength,
      normalX: -dy / displayLength,
      normalY: dx / displayLength,
    }
  })
  const signedPathDifference = sources[1].physicalLength - sources[0].physicalLength
  const pathDifference = Math.abs(signedPathDifference)
  const phaseCycles = pathDifference / config.wavelength
  const nearestWhole = Math.round(phaseCycles)
  const nearestHalf = Math.round(phaseCycles - 0.5) + 0.5
  const wholeError = Math.abs(phaseCycles - nearestWhole)
  const halfError = Math.abs(phaseCycles - nearestHalf)
  const interferenceState = wholeError <= 0.075
    ? { className: 'constructive', label: 'CREST MEETS CREST · CONSTRUCTIVE' }
    : halfError <= 0.075
      ? { className: 'destructive', label: 'CREST MEETS TROUGH · DESTRUCTIVE' }
      : { className: 'partial', label: `PARTIAL INTERFERENCE · ${Math.round((phaseCycles % 1) * 360)}° OFFSET` }

  useEffect(() => {
    if (paused) return undefined
    let frameId
    let previous = performance.now()
    let accumulated = 0
    const tick = (now) => {
      const elapsed = Math.min(0.08, (now - previous) / 1000)
      previous = now
      accumulated += elapsed
      if (accumulated >= 1 / 30) {
        const step = accumulated
        accumulated = 0
        setPhase((current) => (current + step * playbackSpeed * Math.PI * 1.45) % (Math.PI * 2))
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [paused, playbackSpeed])

  useEffect(() => {
    const stepCount = stepSignal - lastStepSignalRef.current
    lastStepSignalRef.current = stepSignal
    if (!paused || stepCount <= 0) return
    const frameAdvance = (stepFrameCount / 30) * playbackSpeed * Math.PI * 1.45
    setPhase((current) => (current + stepCount * frameAdvance) % (Math.PI * 2))
  }, [stepSignal, stepFrameCount, paused, playbackSpeed])

  const pointAlongPath = (path, physicalDistance, offset = 0) => {
    const fraction = clamp(physicalDistance / path.physicalLength, 0, 1)
    return {
      x: path.point.x + path.dx * fraction + path.normalX * offset,
      y: path.point.y + path.dy * fraction + path.normalY * offset,
    }
  }
  const makeWavePath = (path, startDistance = 0, endDistance = path.physicalLength) => {
    const span = Math.max(0, endDistance - startDistance)
    const sampleCount = Math.max(2, Math.ceil(280 * span / path.physicalLength) + 1)
    return Array.from({ length: sampleCount }, (_, index) => {
    const distance = startDistance + (index / (sampleCount - 1)) * span
    const displacement = Math.cos(Math.PI * 2 * distance / config.wavelength - phase) * 5.2
    const point = pointAlongPath(path, distance, displacement)
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
    }).join(' ')
  }
  const phaseMarkers = (path, trough = false) => {
    const movingOffset = (phase / (Math.PI * 2)) * config.wavelength + (trough ? config.wavelength / 2 : 0)
    const firstIndex = Math.ceil(-movingOffset / config.wavelength)
    const markers = []
    for (let index = firstIndex; ; index += 1) {
      const distance = movingOffset + index * config.wavelength
      if (distance > path.physicalLength) break
      if (distance < 0.08 * config.wavelength || distance > path.physicalLength - 0.08 * config.wavelength) continue
      const point = pointAlongPath(path, distance)
      markers.push({ key: `${path.index}-${trough ? 't' : 'c'}-${index}`, ...point })
    }
    return markers
  }
  const angleArc = Array.from({ length: 25 }, (_, index) => {
    const arcAngle = angle * index / 24
    return `${index === 0 ? 'M' : 'L'}${(barrierX + 48 * Math.cos(arcAngle)).toFixed(2)},${(centreY - 48 * Math.sin(arcAngle)).toFixed(2)}`
  }).join(' ')
  const longerPath = sources.reduce((longest, path) => path.physicalLength > longest.physicalLength ? path : longest)
  const bracketOffset = signedPathDifference >= 0 ? 17 : -17
  const bracketStart = pointAlongPath(longerPath, 0, bracketOffset)
  const bracketEnd = pointAlongPath(longerPath, pathDifference, bracketOffset)
  const bracketMid = {
    x: (bracketStart.x + bracketEnd.x) / 2 + longerPath.normalX * bracketOffset * 0.65,
    y: (bracketStart.y + bracketEnd.y) / 2 + longerPath.normalY * bracketOffset * 0.65,
  }
  const extraPathLabel = {
    x: clamp(Math.max(bracketEnd.x, bracketMid.x) + 18, barrierX + 34, screenX - 116),
    y: clamp(bracketMid.y + (longerPath.index === 0 ? -19 : 17), 27, height - 40),
  }
  const shorterPath = sources.find((path) => path.index !== longerPath.index)
  const projectedPathDifference = Math.abs(config.spacing * Math.sin(angle))
  const projectionFoot = pointAlongPath(longerPath, projectedPathDifference)
  const projectionDx = shorterPath.point.x - projectionFoot.x
  const projectionDy = shorterPath.point.y - projectionFoot.y
  const projectionLength = Math.max(0.001, Math.hypot(projectionDx, projectionDy))
  const projectionUnit = { x: projectionDx / projectionLength, y: projectionDy / projectionLength }
  const rayUnit = { x: longerPath.dx / longerPath.displayLength, y: longerPath.dy / longerPath.displayLength }
  const rightAnglePath = [
    { x: projectionFoot.x - rayUnit.x * 7, y: projectionFoot.y - rayUnit.y * 7 },
    { x: projectionFoot.x - rayUnit.x * 7 + projectionUnit.x * 7, y: projectionFoot.y - rayUnit.y * 7 + projectionUnit.y * 7 },
    { x: projectionFoot.x + projectionUnit.x * 7, y: projectionFoot.y + projectionUnit.y * 7 },
  ].map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const barrierSegments = [
    [24, sources[0].point.y - apertureHalfHeight],
    [sources[0].point.y + apertureHalfHeight, sources[1].point.y - apertureHalfHeight],
    [sources[1].point.y + apertureHalfHeight, height - 24],
  ].filter(([start, end]) => end > start)
  const wavelengthPixels = config.wavelength * spatialScale
  const incomingSpacing = Math.max(8, wavelengthPixels / 2)
  const incomingTravel = (phase / (Math.PI * 2)) * wavelengthPixels
  const incomingFronts = Array.from({ length: Math.ceil((barrierX - 12) / incomingSpacing) + 2 }, (_, index) => ({
    x: barrierX - ((index * incomingSpacing - incomingTravel) % (barrierX - 12 + incomingSpacing)),
    trough: index % 2 === 1,
  })).filter((front) => front.x > 10 && front.x < barrierX - 5)
  const readoutSize = { width: 268, height: 73 }
  const readoutBase = { x: 552, y: 28 }
  const readoutPosition = {
    x: clamp(readoutBase.x + readoutOffset.x, 8, width - readoutSize.width - 8),
    y: clamp(readoutBase.y + readoutOffset.y, 8, height - readoutSize.height - 8),
  }
  const geometryCardSize = { width: 247, height: 91 }
  const geometryCardBase = { x: 573, y: 383 }
  const geometryCardPosition = {
    x: clamp(geometryCardBase.x + geometryOffset.x, 8, width - geometryCardSize.width - 8),
    y: clamp(geometryCardBase.y + geometryOffset.y, 8, height - geometryCardSize.height - 8),
  }

  const pointerPositionInField = (event) => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(matrix.inverse())
  }
  const chooseDirection = (event) => {
    const local = pointerPositionInField(event)
    if (!local) return
    const chosenScreenY = clamp((centreY - local.y) / verticalScale, -config.screenHalfHeight, config.screenHalfHeight)
    onSelect?.(Math.atan2(chosenScreenY, config.screenDistance))
  }
  const beginDirectionDrag = (event) => {
    if (event.button !== 0) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    chooseDirection(event)
  }
  const continueDirectionDrag = (event) => {
    if (draggingRef.current) chooseDirection(event)
  }
  const endDirectionDrag = (event) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const beginReadoutDrag = (event) => {
    const point = pointerPositionInField(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    readoutDragRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      offsetX: readoutPosition.x - readoutBase.x,
      offsetY: readoutPosition.y - readoutBase.y,
    }
  }
  const moveReadout = (event) => {
    const drag = readoutDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = pointerPositionInField(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    const requestedX = readoutBase.x + drag.offsetX + point.x - drag.startX
    const requestedY = readoutBase.y + drag.offsetY + point.y - drag.startY
    setReadoutOffset({
      x: clamp(requestedX, 8, width - readoutSize.width - 8) - readoutBase.x,
      y: clamp(requestedY, 8, height - readoutSize.height - 8) - readoutBase.y,
    })
  }
  const endReadoutDrag = (event) => {
    if (readoutDragRef.current?.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    readoutDragRef.current = null
  }
  const beginGeometryDrag = (event) => {
    const point = pointerPositionInField(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    geometryDragRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      offsetX: geometryCardPosition.x - geometryCardBase.x,
      offsetY: geometryCardPosition.y - geometryCardBase.y,
    }
  }
  const moveGeometryCard = (event) => {
    const drag = geometryDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = pointerPositionInField(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    const requestedX = geometryCardBase.x + drag.offsetX + point.x - drag.startX
    const requestedY = geometryCardBase.y + drag.offsetY + point.y - drag.startY
    setGeometryOffset({
      x: clamp(requestedX, 8, width - geometryCardSize.width - 8) - geometryCardBase.x,
      y: clamp(requestedY, 8, height - geometryCardSize.height - 8) - geometryCardBase.y,
    })
  }
  const endGeometryDrag = (event) => {
    if (geometryDragRef.current?.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    geometryDragRef.current = null
  }

  return (
    <div className="multi-field-wrap path-difference-wrap">
      <svg
        ref={svgRef}
        className="multi-field path-difference-field"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Two waves travel from the slits towards one observation direction at ${formatAngle(angle)}. Their path difference is ${formatValue(pathDifference)} units, or ${formatValue(phaseCycles)} wavelengths.`}
        onPointerDown={beginDirectionDrag}
        onPointerMove={continueDirectionDrag}
        onPointerUp={endDirectionDrag}
        onPointerCancel={endDirectionDrag}
      >
        <defs>
          <linearGradient id="path-difference-bg" x1="0" x2="1">
            <stop offset="0" stopColor="#06121c" />
            <stop offset="0.52" stopColor="#0a2130" />
            <stop offset="1" stopColor="#071823" />
          </linearGradient>
        </defs>
        <rect className="path-difference-bg" width={width} height={height} fill="url(#path-difference-bg)" />

        <g className="path-incident-fronts" aria-hidden="true">
          {incomingFronts.map((front, index) => (
            <line className={front.trough ? 'trough' : 'crest'} key={index} x1={front.x} y1="34" x2={front.x} y2={height - 34} />
          ))}
        </g>
        <g className="path-direction-label" aria-hidden="true">
          <line x1="22" y1="66" x2={barrierX - 17} y2="66" />
          <path d={`M${barrierX - 17} 66l-10-6v12Z`} />
          <text x="22" y="55">coherent plane wave</text>
        </g>

        {barrierSegments.map(([start, end], index) => (
          <line className="path-barrier" key={index} x1={barrierX} y1={start} x2={barrierX} y2={end} />
        ))}
        {sources.map((source) => <circle className="path-source" key={source.index} cx={source.point.x} cy={source.point.y} r="5" />)}
        <text className="path-apparatus-label" x={barrierX - 13} y={height - 13} textAnchor="end">two coherent slits</text>

        <line className="path-centre-axis" x1={barrierX} y1={centreY} x2={screenX} y2={centreY} />
        <line className="path-selected-direction" x1={barrierX} y1={centreY} x2={target.x} y2={target.y} />
        {showFringeGeometry && (
          <g className="path-fringe-geometry path-fringe-geometry-underlay" aria-hidden="true">
            <line className="geometry-hypotenuse" x1={barrierX} y1={centreY} x2={target.x} y2={target.y} />
          </g>
        )}
        <path className="path-angle-arc" d={angleArc} />
        <text className="path-angle-label" x={barrierX + 62} y={centreY - Math.sign(angle || 1) * 18}>θ = {formatAngle(angle)}</text>

        {sources.map((path) => (
          <g className="path-wave" key={path.index}>
            <line className="path-ray" x1={path.point.x} y1={path.point.y} x2={target.x} y2={target.y} />
            <path className="path-waveform" d={makeWavePath(path)} />
            {path.index === longerPath.index && pathDifference > 0.03 && (
              <path className="path-extra-wave" d={makeWavePath(path, 0, pathDifference)} />
            )}
            {phaseMarkers(path).map((marker) => (
              <line className="path-phase-marker crest" key={marker.key} x1={marker.x - path.normalX * 6} y1={marker.y - path.normalY * 6} x2={marker.x + path.normalX * 6} y2={marker.y + path.normalY * 6} />
            ))}
            {phaseMarkers(path, true).map((marker) => (
              <line className="path-phase-marker trough" key={marker.key} x1={marker.x - path.normalX * 5} y1={marker.y - path.normalY * 5} x2={marker.x + path.normalX * 5} y2={marker.y + path.normalY * 5} />
            ))}
            <text className="path-length-label" x={path.point.x + path.dx * 0.58 + path.normalX * (path.index === 0 ? -15 : 15)} y={path.point.y + path.dy * 0.58 + path.normalY * (path.index === 0 ? -15 : 15)}>
              r{path.index + 1} = {formatValue(path.physicalLength)}
            </text>
          </g>
        ))}

        {pathDifference > 0.03 && (
          <g className="path-difference-bracket">
            <line x1={bracketStart.x} y1={bracketStart.y} x2={bracketEnd.x} y2={bracketEnd.y} />
            <line className="cap" x1={bracketStart.x - longerPath.normalX * 5} y1={bracketStart.y - longerPath.normalY * 5} x2={bracketStart.x + longerPath.normalX * 5} y2={bracketStart.y + longerPath.normalY * 5} />
            <line className="cap" x1={bracketEnd.x - longerPath.normalX * 5} y1={bracketEnd.y - longerPath.normalY * 5} x2={bracketEnd.x + longerPath.normalX * 5} y2={bracketEnd.y + longerPath.normalY * 5} />
            <line className="label-leader" x1={bracketMid.x} y1={bracketMid.y} x2={extraPathLabel.x - 7} y2={extraPathLabel.y - 3} />
            <text x={extraPathLabel.x} y={extraPathLabel.y} textAnchor="start">
              {showFringeGeometry && <tspan className="projected-path-line" x={extraPathLabel.x} dy="0">s sin θ</tspan>}
              <tspan x={extraPathLabel.x} dy={showFringeGeometry ? 13 : 0}>extra path Δ</tspan>
            </text>
          </g>
        )}

        <g className="path-screen">
          <line x1={screenX} y1={screenTop} x2={screenX} y2={screenBottom} />
          <circle className="path-target-halo" cx={target.x} cy={target.y} r="13" />
          <circle className="path-target" cx={target.x} cy={target.y} r="6" />
          <text x={screenX - 12} y="39" textAnchor="end">observation direction</text>
          <text className="path-target-label" x={target.x - 12} y={target.y - 14} textAnchor="end">P</text>
        </g>

        {showFringeGeometry && (
          <g className="path-fringe-geometry" aria-label="Fringe geometry for the selected observation direction">
            <g className="path-large-triangle">
              <line className="geometry-base" x1={barrierX} y1={centreY} x2={screenX} y2={centreY} />
              <line className="geometry-height" x1={screenX} y1={centreY} x2={target.x} y2={target.y} />
              <text className="geometry-base-label" x={(barrierX + screenX) / 2} y={centreY + 17} textAnchor="middle">D</text>
              <text className="geometry-height-label" x={screenX - 10} y={(centreY + target.y) / 2} textAnchor="end">w</text>
            </g>
            <g className="path-small-triangle">
              <line className="geometry-separation" x1={barrierX - 18} y1={sources[0].point.y} x2={barrierX - 18} y2={sources[1].point.y} />
              <line className="geometry-cap" x1={barrierX - 23} y1={sources[0].point.y} x2={barrierX - 13} y2={sources[0].point.y} />
              <line className="geometry-cap" x1={barrierX - 23} y1={sources[1].point.y} x2={barrierX - 13} y2={sources[1].point.y} />
              <text className="geometry-separation-label" x={barrierX - 27} y={centreY + 4} textAnchor="end">s</text>
              <line className="geometry-projection" x1={shorterPath.point.x} y1={shorterPath.point.y} x2={projectionFoot.x} y2={projectionFoot.y} />
              <line className="geometry-projected-path" x1={longerPath.point.x} y1={longerPath.point.y} x2={projectionFoot.x} y2={projectionFoot.y} />
              <path className="geometry-right-angle" d={rightAnglePath} />
            </g>
            <g
              className="path-geometry-card"
              transform={`translate(${geometryCardPosition.x} ${geometryCardPosition.y})`}
              onPointerDown={beginGeometryDrag}
              onPointerMove={moveGeometryCard}
              onPointerUp={endGeometryDrag}
              onPointerCancel={endGeometryDrag}
              onClick={(event) => event.stopPropagation()}
              aria-label="Drag the fringe-geometry explanation card to reposition it"
            >
              <rect width="247" height="91" rx="4" />
              <text className="geometry-title" x="12" y="18">FRINGE GEOMETRY</text>
              <text x="12" y="38">small triangle:  Δ ≈ s sin θ</text>
              <text x="12" y="55">screen triangle:  tan θ = w / D</text>
              <text className="geometry-result" x="12" y="74">bright fringe:  Δ = n<tspan className="textbook-lambda">λ</tspan></text>
            </g>
          </g>
        )}

        <g className="path-phase-key" transform="translate(144 34)">
          <line className="crest" x1="0" y1="0" x2="25" y2="0" /><text x="32" y="4">crest</text>
          <line className="trough" x1="92" y1="0" x2="117" y2="0" /><text x="124" y="4">trough</text>
        </g>
        <g
          className="path-readout"
          transform={`translate(${readoutPosition.x} ${readoutPosition.y})`}
          onPointerDown={beginReadoutDrag}
          onPointerMove={moveReadout}
          onPointerUp={endReadoutDrag}
          onPointerCancel={endReadoutDrag}
          onClick={(event) => event.stopPropagation()}
          aria-label="Drag the path-difference readout to reposition it"
        >
          <rect width={readoutSize.width} height={readoutSize.height} rx="4" />
          <text className="path-readout-title" x="13" y="18">PATH DIFFERENCE AT P</text>
          <text className="path-readout-value" x="13" y="41">Δ = |r₂ − r₁| = {formatValue(pathDifference)} = {formatValue(phaseCycles)}<tspan className="textbook-lambda">λ</tspan></text>
          <text className={`path-readout-state ${interferenceState.className}`} x="13" y="61">{interferenceState.label}</text>
        </g>
        <text className="path-interaction-hint" x={width / 2} y={height - 14} textAnchor="middle">CLICK OR DRAG TO CHOOSE THE OBSERVATION DIRECTION</text>
      </svg>
      <button
        className={"fringe-geometry-toggle" + (showFringeGeometry ? " active" : "")}
        type="button"
        onClick={onToggleFringeGeometry}
        aria-pressed={showFringeGeometry}
      >
        {showFringeGeometry ? "Hide fringe geometry" : "Show fringe geometry"}
      </button>
    </div>
  )
}

function MultiSlitField({ config, selectedAngle, onSelect, paused, playbackSpeed, stepSignal = 0, stepFrameCount = 4, viewMode, selectedOrder = 0, onSelectOrder, fieldZoom = 1, onFieldZoom, showFringeGeometry = false, onToggleFringeGeometry, showOrderGeometry = false, onToggleOrderGeometry }) {
  const animationRef = useRef(null)
  const phaseRef = useRef(0)
  const lastStepSignalRef = useRef(stepSignal)
  const principalTraceRef = useRef(0)
  const constructionVisibilityRef = useRef(1)
  const geometryCardDragRef = useRef(null)
  const geometryCardTextRef = useRef(null)
  const fieldRef = useRef(null)
  const [hoveredSource, setHoveredSource] = useState(null)
  const [geometryCardOffset, setGeometryCardOffset] = useState({ x: 0, y: 0 })
  const [geometryCardBounds, setGeometryCardBounds] = useState({ width: 230, height: 84 })
  const sourceHoverEnabled = viewMode === 'principal-orders' || viewMode === 'wavefronts'
  const width = 900
  const height = 510
  const screenlessGrating = config.kind !== 'double-slit'
  const farFieldView = config.kind !== 'double-slit' && (viewMode === 'instantaneous' || viewMode === 'intensity')
  const fillPaneGratingView = screenlessGrating && (viewMode === 'principal-orders' || viewMode === 'wavefronts')
  const activeFieldZoom = farFieldView ? fieldZoom : 1
  const baseVerticalExtent = Math.max(9.5, (config.sourceCount - 1) * config.spacing / 2 + 0.9)
  const verticalExtent = baseVerticalExtent * activeFieldZoom
  const padding = 18
  const worldMinX = -6.5
  const requestedFieldEndX = farFieldView ? config.screenDistance * activeFieldZoom : config.screenDistance
  const baseWorldMaxX = farFieldView ? Math.max(24.5, requestedFieldEndX + 2.5) : 24.5
  const horizontalDrawingWidth = farFieldView || fillPaneGratingView ? width : width - padding * 2
  const scale = Math.min(
    horizontalDrawingWidth / (baseWorldMaxX - worldMinX),
    (height - padding * 2) / (verticalExtent * 2),
  )
  const worldMaxX = farFieldView || fillPaneGratingView
    ? Math.max(baseWorldMaxX, worldMinX + width / scale)
    : baseWorldMaxX
  const world = { minX: worldMinX, maxX: worldMaxX, minY: -verticalExtent, maxY: verticalExtent }
  const fieldEndX = farFieldView || screenlessGrating ? worldMaxX : config.screenDistance
  const contentWidth = (world.maxX - world.minX) * scale
  const originX = farFieldView || fillPaneGratingView
    ? -world.minX * scale
    : (width - contentWidth) / 2 - world.minX * scale
  const centreY = height / 2
  const toX = (value) => originX + value * scale
  const toY = (value) => centreY - value * scale
  const barrierX = toX(0)
  const screenX = toX(config.screenDistance)
  const fieldEndScreenX = toX(fieldEndX)
  const screenHalfHeight = config.screenHalfHeight
  const screenTop = toY(screenHalfHeight)
  const screenBottom = toY(-screenHalfHeight)
  const screenHeight = screenBottom - screenTop
  const showObservationScreen = !screenlessGrating
  const wavelengthPixels = config.wavelength * scale
  const phaseFrontSpacing = wavelengthPixels / 2
  const frontCount = Math.ceil((-world.minX * scale) / phaseFrontSpacing) + 2
  const maximumRadius = Math.hypot(screenlessGrating ? worldMaxX : config.screenDistance, screenHalfHeight + 8) * scale
  const ringCount = Math.ceil(maximumRadius / phaseFrontSpacing) + 2
  const sourcePositions = Array.from({ length: config.sourceCount }, (_, index) => (
    (index - (config.sourceCount - 1) / 2) * config.spacing
  ))
  const maximumOrder = Math.floor(config.spacing / config.wavelength)
  const principalOrders = Array.from({ length: maximumOrder * 2 + 1 }, (_, index) => index - maximumOrder)
  const activeOrder = clamp(selectedOrder, -maximumOrder, maximumOrder)
  const activeOrderAngle = Math.asin(activeOrder * config.wavelength / config.spacing)
  const apertureWidth = config.kind === 'double-slit'
    ? config.slitWidth
    : Math.min(0.3, config.spacing * 0.28)
  const barrierSegments = []
  let barrierSegmentStart = world.minY + 0.4
  sourcePositions.forEach((sourceY) => {
    const openingStart = sourceY - apertureWidth / 2
    const openingEnd = sourceY + apertureWidth / 2
    if (openingStart > barrierSegmentStart) barrierSegments.push([barrierSegmentStart, openingStart])
    barrierSegmentStart = openingEnd
  })
  if (barrierSegmentStart < world.maxY - 0.4) barrierSegments.push([barrierSegmentStart, world.maxY - 0.4])
  const gridXs = Array.from(
    { length: Math.floor(world.maxX - world.minX) + 1 },
    (_, index) => Math.ceil(world.minX) + index,
  ).filter((value) => value <= world.maxX)
  const gridYs = Array.from(
    { length: Math.floor(world.maxY - world.minY) + 1 },
    (_, index) => Math.ceil(world.minY) + index,
  ).filter((value) => value <= world.maxY)

  useEffect(() => {
    if (viewMode === 'principal-orders') {
      // Start both animation clocks together so the highlighted construction
      // is always painted directly over the corresponding ordinary crests.
      phaseRef.current = 0
      principalTraceRef.current = 0
    } else setHoveredSource(null)
  }, [viewMode, activeOrderAngle])

  useEffect(() => {
    const stepCount = stepSignal - lastStepSignalRef.current
    lastStepSignalRef.current = stepSignal
    if (!paused || stepCount <= 0 || config.kind !== 'double-slit' || viewMode === 'intensity') return
    const frameAdvanceInMilliseconds = stepFrameCount * (1000 / 30)
    const periodAdvance = frameAdvanceInMilliseconds * 0.00055 * playbackSpeed / config.wavelength
    phaseRef.current = (phaseRef.current + stepCount * periodAdvance) % 1
  }, [stepSignal, stepFrameCount, paused, playbackSpeed, viewMode, config.kind, config.wavelength])

  useEffect(() => {
    const canvas = animationRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    const heatmapCanvas = document.createElement('canvas')
    const heatmapContext = heatmapCanvas.getContext('2d')
    let frameId
    let previous = performance.now()
    const frameInterval = 1000 / 30

    const drawWavefronts = (currentPhase) => {
      context.clearRect(0, 0, width, height)
      const travel = currentPhase * wavelengthPixels
      const setWavefrontDash = (isTrough, pathLength) => {
        if (!isTrough) {
          context.setLineDash([])
          context.lineDashOffset = 0
          return
        }

        const dashLength = 5
        context.setLineDash([dashLength, 5])
        // Centre a complete dash on the path midpoint. As an expanding path
        // lengthens, its dash pattern therefore grows equally from both ends.
        context.lineDashOffset = dashLength / 2 - pathLength / 2
      }
      const principalOrderMode = viewMode === 'principal-orders'
      const principalTrace = principalOrderMode ? (() => {
        const directionY = Math.sin(activeOrderAngle)
        const cycle = principalTraceRef.current
        const leadingSourceProjection = Math.max(...sourcePositions.map((sourceY) => sourceY * directionY))
        const smoothStep = (value) => {
          const bounded = clamp(value, 0, 1)
          return bounded * bounded * (3 - 2 * bounded)
        }
        const fadeIn = smoothStep(cycle / 0.28)
        const fadeOut = cycle <= 4.8 ? 1 : 1 - smoothStep((cycle - 4.8) / 0.85)
        return {
          cycle,
          directionY,
          projection: leadingSourceProjection + cycle * config.wavelength,
          opacity: fadeIn * fadeOut,
        }
      })() : null

      context.save()
      context.lineWidth = 1.8
      const incidentFrontLength = Math.abs(toY(world.minY + 0.8) - toY(world.maxY - 0.8))
      for (let index = 0; index < frontCount; index += 1) {
        const x = barrierX - index * phaseFrontSpacing + travel
        if (x > barrierX) continue
        const isTrough = index % 2 === 1
        if (principalOrderMode && isTrough) continue
        setWavefrontDash(isTrough, incidentFrontLength)
        context.strokeStyle = principalOrderMode
          ? 'rgba(142, 235, 252, 0.78)'
          : (isTrough ? 'rgba(142, 235, 252, 0.56)' : 'rgba(174, 244, 255, 0.84)')
        context.beginPath()
        context.moveTo(x, toY(world.maxY - 0.8))
        context.lineTo(x, toY(world.minY + 0.8))
        context.stroke()
      }
      context.restore()

      context.save()
      context.beginPath()
      context.rect(barrierX - 0.5, 0, Math.max(0, fieldEndScreenX - barrierX - 4.5), height)
      context.clip()
      context.lineWidth = 1.25
      sourcePositions.forEach((sourceY, sourceIndex) => {
        for (let ringIndex = -2; ringIndex < ringCount; ringIndex += 1) {
          const radius = ringIndex * phaseFrontSpacing + travel
          if (radius < 0 || radius > maximumRadius) continue
          const isTrough = Math.abs(ringIndex) % 2 === 1
          if (principalOrderMode && isTrough) continue
          setWavefrontDash(isTrough, Math.PI * radius)
          if (principalOrderMode) {
            const sourceIsHovered = sourceIndex === hoveredSource
            const radiusWorld = radius / scale
            const crestProjection = sourceY * principalTrace.directionY + radiusWorld
            const fadeDistance = (crestProjection - principalTrace.projection) / (config.wavelength * 0.35)
            const boundedFade = clamp(fadeDistance, 0, 1)
            const smoothFade = boundedFade * boundedFade * (3 - 2 * boundedFade)
            const aheadOfFront = smoothFade * principalTrace.opacity
            const fadedRed = Math.round(102 + aheadOfFront * 103)
            const fadedGreen = Math.round(221 - aheadOfFront)
            const fadedBlue = Math.round(243 - aheadOfFront * 19)
            context.strokeStyle = sourceIsHovered
              ? 'rgba(255, 255, 255, 0.94)'
              : `rgba(${fadedRed}, ${fadedGreen}, ${fadedBlue}, 0.2)`
            context.lineWidth = (sourceIsHovered ? 1.8 : 1.25) * (1 - aheadOfFront * 0.48)
            context.shadowColor = sourceIsHovered ? 'rgba(255, 255, 255, 0.62)' : 'transparent'
            context.shadowBlur = sourceIsHovered ? 6 * (1 - aheadOfFront) : 0
            context.globalAlpha = principalTrace.opacity * (1 - smoothFade * 0.78)
          } else {
            const sourceIsHovered = viewMode === 'wavefronts' && sourceIndex === hoveredSource
            const brightWavefrontView = viewMode === 'wavefronts'
            context.strokeStyle = sourceIsHovered
              ? (isTrough ? 'rgba(255, 255, 255, 0.74)' : 'rgba(255, 255, 255, 0.9)')
              : brightWavefrontView
                ? (isTrough ? 'rgba(142, 235, 252, 0.4)' : 'rgba(174, 244, 255, 0.62)')
                : (isTrough ? 'rgba(134, 230, 248, 0.25)' : 'rgba(155, 239, 253, 0.38)')
            context.lineWidth = sourceIsHovered ? 1.15 : brightWavefrontView ? 1.5 : 1.35
            context.shadowColor = 'transparent'
            context.shadowBlur = 0
            context.globalAlpha = 1
          }
          context.beginPath()
          context.arc(barrierX, toY(sourceY), radius, -Math.PI / 2, Math.PI / 2)
          context.stroke()
        }
      })
      context.globalAlpha = 1
      context.restore()

      if (principalOrderMode) {
        const directionX = Math.cos(activeOrderAngle)
        const directionY = Math.sin(activeOrderAngle)
        const perpendicularX = -directionY
        const perpendicularY = directionX
        const travelWorld = currentPhase * config.wavelength
        const maximumProjection = config.screenDistance * directionX + config.screenHalfHeight * Math.abs(directionY) + 3
        const referenceProjection = sourcePositions[0] * directionY
        const traceCycle = principalTrace.cycle
        const selectedProjection = principalTrace.projection
        const selectedOpacity = principalTrace.opacity
        const firstCrestNumber = Math.floor((-config.screenHalfHeight - referenceProjection - travelWorld) / config.wavelength) - 2
        const lastCrestNumber = Math.ceil((maximumProjection - referenceProjection - travelWorld) / config.wavelength) + 1
        const highlightedFronts = selectedOpacity > 0.002
          ? [{ projection: selectedProjection, opacity: selectedOpacity }]
          : []

        context.save()
        context.beginPath()
        context.rect(barrierX + 2, 0, Math.max(0, fieldEndScreenX - barrierX - 4), height)
        context.clip()
        for (let crestNumber = firstCrestNumber; crestNumber <= lastCrestNumber; crestNumber += 1) {
          const projection = referenceProjection + travelWorld + crestNumber * config.wavelength
          const centreXWorld = projection * directionX
          const centreYWorld = projection * directionY
          const extent = 22
          context.strokeStyle = 'rgba(116, 230, 250, 0.2)'
          context.lineWidth = 1.05
          context.shadowColor = 'transparent'
          context.shadowBlur = 0
          context.beginPath()
          context.moveTo(
            toX(centreXWorld - perpendicularX * extent),
            toY(centreYWorld - perpendicularY * extent),
          )
          context.lineTo(
            toX(centreXWorld + perpendicularX * extent),
            toY(centreYWorld + perpendicularY * extent),
          )
          context.stroke()
        }

        highlightedFronts.forEach((front) => {
          const centreXWorld = front.projection * directionX
          const centreYWorld = front.projection * directionY
          const extent = 22
          context.save()
          context.strokeStyle = 'rgba(119, 235, 253,' + (0.98 * front.opacity) + ')'
          context.lineWidth = 3.1
          context.shadowColor = 'rgba(102, 221, 243,' + (0.72 * front.opacity) + ')'
          context.shadowBlur = 8
          context.beginPath()
          context.moveTo(
            toX(centreXWorld - perpendicularX * extent),
            toY(centreYWorld - perpendicularY * extent),
          )
          context.lineTo(
            toX(centreXWorld + perpendicularX * extent),
            toY(centreYWorld + perpendicularY * extent),
          )
          context.stroke()
          context.restore()

          const constructionOpacity = front.opacity * constructionVisibilityRef.current
          if (constructionOpacity < 0.012) return

          sourcePositions.forEach((sourceY, sourceIndex) => {
            const radiusWorld = front.projection - sourceY * directionY
            if (radiusWorld <= 0) return
            const sourceIsHovered = sourceIndex === hoveredSource
            const sourceXPixel = barrierX
            const sourceYPixel = toY(sourceY)
            const radiusPixels = radiusWorld * scale
            const contactXWorld = radiusWorld * directionX
            const contactYWorld = sourceY + radiusWorld * directionY
            const contactXPixel = toX(contactXWorld)
            const contactYPixel = toY(contactYWorld)

            context.save()
            context.globalAlpha = 0.96 * constructionOpacity
            context.strokeStyle = sourceIsHovered ? '#ffffff' : '#7cea97'
            context.lineWidth = sourceIsHovered ? 2.8 : 2.45
            context.shadowColor = sourceIsHovered ? '#ffffff' : '#7cea97'
            context.shadowBlur = 7
            context.setLineDash([])
            context.beginPath()
            context.arc(sourceXPixel, sourceYPixel, radiusPixels, -Math.PI / 2, Math.PI / 2)
            context.stroke()
            context.restore()

            context.save()
            context.globalAlpha = constructionOpacity
            context.strokeStyle = '#ffd477'
            context.lineWidth = 0.9
            context.setLineDash([3, 4])
            context.beginPath()
            context.moveTo(sourceXPixel, sourceYPixel)
            context.lineTo(contactXPixel, contactYPixel)
            context.stroke()
            context.setLineDash([])
            context.fillStyle = '#ffd477'
            context.beginPath()
            context.arc(contactXPixel, contactYPixel, 3.4, 0, Math.PI * 2)
            context.fill()
            context.font = '700 8px DM Sans, sans-serif'
            context.textAlign = 'center'
            context.textBaseline = 'bottom'
            context.fillText(String(sourceIndex + 1), contactXPixel, contactYPixel - 5)
            context.restore()
          })
        })
        context.restore()
      }
    }

    const mapWidth = Math.round(240 + (activeFieldZoom - 1) * 40)
    const mapHeight = 156
    heatmapCanvas.width = mapWidth
    heatmapCanvas.height = mapHeight
    const heatmapImage = heatmapContext.createImageData(mapWidth, mapHeight)
    const fieldReal = new Float32Array(mapWidth * mapHeight)
    const fieldImaginary = new Float32Array(mapWidth * mapHeight)
    const fieldIntensity = new Float32Array(mapWidth * mapHeight)

    const prepareHeatmap = () => {
      const waveNumber = 2 * Math.PI / config.wavelength

      for (let py = 0; py < mapHeight; py += 1) {
        const y = world.maxY - (py / (mapHeight - 1)) * (world.maxY - world.minY)
        for (let px = 0; px < mapWidth; px += 1) {
          const x = 0.04 + (px / (mapWidth - 1)) * (fieldEndX - 0.04)
          let real = 0
          let imaginary = 0

          sourcePositions.forEach((sourceY) => {
            const dy = y - sourceY
            const distance = Math.max(0.04, Math.hypot(x, dy))
            const sineTheta = dy / distance
            const apertureFactor = sinc(Math.PI * apertureWidth * sineTheta / config.wavelength)
            const angle = waveNumber * distance
            real += apertureFactor * Math.cos(angle)
            imaginary += apertureFactor * Math.sin(angle)
          })

          const fieldIndex = py * mapWidth + px
          fieldReal[fieldIndex] = real
          fieldImaginary[fieldIndex] = imaginary
          fieldIntensity[fieldIndex] = clamp(
            (real * real + imaginary * imaginary) / (config.sourceCount * config.sourceCount),
            0,
            1,
          )
        }
      }
    }

    const drawHeatmap = (mode, currentPhase) => {
      const pixels = heatmapImage.data
      const timeAngle = currentPhase * Math.PI * 2
      const cosineTime = Math.cos(timeAngle)
      const sineTime = Math.sin(timeAngle)

      for (let fieldIndex = 0; fieldIndex < fieldReal.length; fieldIndex += 1) {
        const pixelIndex = fieldIndex * 4
        if (mode === 'intensity') {
          const intensity = fieldIntensity[fieldIndex]
          const glow = Math.pow(intensity, 0.42)
          pixels[pixelIndex] = Math.round(5 + 62 * glow + 62 * intensity)
          pixels[pixelIndex + 1] = Math.round(17 + 156 * glow + 61 * intensity)
          pixels[pixelIndex + 2] = Math.round(29 + 188 * glow + 38 * intensity)
        } else {
          const signed = clamp(
            (fieldReal[fieldIndex] * cosineTime + fieldImaginary[fieldIndex] * sineTime) / config.sourceCount,
            -1,
            1,
          )
          const magnitude = Math.abs(signed)
          const brightness = Math.pow(magnitude, 1.35)
          const targetColour = signed >= 0 ? [114, 236, 255] : [255, 112, 93]
          pixels[pixelIndex] = Math.round(5 + (targetColour[0] - 5) * brightness)
          pixels[pixelIndex + 1] = Math.round(17 + (targetColour[1] - 17) * brightness)
          pixels[pixelIndex + 2] = Math.round(29 + (targetColour[2] - 29) * brightness)
        }
        pixels[pixelIndex + 3] = 255
      }

      heatmapContext.putImageData(heatmapImage, 0, 0)
      context.save()
      context.imageSmoothingEnabled = true
      context.drawImage(heatmapCanvas, barrierX, 0, fieldEndScreenX - barrierX, height)
      context.restore()
    }

    prepareHeatmap()
    const renderFrame = (currentPhase) => {
      drawWavefronts(currentPhase)
      if (viewMode === 'intensity') drawHeatmap('intensity', currentPhase)
      if (viewMode === 'instantaneous') drawHeatmap('instantaneous', currentPhase)
    }

    const constructionTarget = viewMode === 'principal-orders' && hoveredSource != null ? 0 : 1
    const constructionIsTransitioning = () => Math.abs(constructionVisibilityRef.current - constructionTarget) > 0.002

    renderFrame(phaseRef.current)
    if (viewMode === 'intensity') {
      return undefined
    }
    if (paused && !constructionIsTransitioning()) return undefined

    const advance = (now) => {
      const elapsed = now - previous
      if (elapsed >= frameInterval) {
        previous = now - (elapsed % frameInterval)
        const animationElapsed = Math.min(60, elapsed)
        if (!paused) {
          const periodAdvance = animationElapsed * 0.00055 * playbackSpeed / config.wavelength
          phaseRef.current = (phaseRef.current + periodAdvance) % 1
          if (viewMode === 'principal-orders') {
            principalTraceRef.current = (principalTraceRef.current + periodAdvance) % 6
          }
        }
        if (constructionIsTransitioning()) {
          const fadeDuration = constructionTarget === 0 ? 110 : 180
          const maximumChange = animationElapsed / fadeDuration
          const difference = constructionTarget - constructionVisibilityRef.current
          constructionVisibilityRef.current += Math.sign(difference) * Math.min(Math.abs(difference), maximumChange)
        }
        renderFrame(phaseRef.current)
      }
      if (!paused || constructionIsTransitioning()) frameId = requestAnimationFrame(advance)
    }
    frameId = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frameId)
  }, [paused, playbackSpeed, stepSignal, viewMode, hoveredSource, activeOrderAngle, activeFieldZoom, fieldEndX, fieldEndScreenX, config.kind, config.wavelength, config.spacing, config.slitWidth, config.sourceCount, config.screenDistance, config.screenHalfHeight])

  const choosePoint = (event) => {
    const rect = fieldRef.current.getBoundingClientRect()
    const viewRatio = width / height
    const elementRatio = rect.width / rect.height
    const renderedWidth = elementRatio > viewRatio ? rect.height * viewRatio : rect.width
    const renderedHeight = elementRatio > viewRatio ? rect.height : rect.width / viewRatio
    const offsetX = (rect.width - renderedWidth) / 2
    const offsetY = (rect.height - renderedHeight) / 2
    const localX = event.clientX - rect.left - offsetX
    const localY = event.clientY - rect.top - offsetY
    if (localX < 0 || localX > renderedWidth || localY < 0 || localY > renderedHeight) return
    const x = (localX / renderedWidth) * width
    const y = (localY / renderedHeight) * height
    const selectableEndX = screenlessGrating ? fieldEndScreenX : screenX
    if (x <= barrierX + 5 || x > selectableEndX + 8) return
    if (viewMode === 'principal-orders') {
      const nearestRay = principalOrderRays
        .map((ray) => {
          const startX = barrierX + 3
          const startY = centreY
          const endX = toX(ray.endX)
          const endY = toY(ray.endY)
          const deltaX = endX - startX
          const deltaY = endY - startY
          const lengthSquared = deltaX * deltaX + deltaY * deltaY
          const fraction = lengthSquared < 1e-8
            ? 0
            : clamp(((x - startX) * deltaX + (y - startY) * deltaY) / lengthSquared, 0, 1)
          const closestX = startX + fraction * deltaX
          const closestY = startY + fraction * deltaY
          return { order: ray.order, distance: Math.hypot(x - closestX, y - closestY) }
        })
        .sort((first, second) => first.distance - second.distance)[0]
      if (nearestRay?.distance <= 18) onSelectOrder?.(nearestRay.order)
      return
    }
    const horizontalDistance = (x - barrierX) / scale
    const clickedWorldY = (centreY - y) / scale
    const selectionOriginY = screenlessGrating && viewMode === 'wavefronts'
      ? sourcePositions[Math.floor(config.sourceCount / 2)]
      : 0
    const verticalDistance = clickedWorldY - selectionOriginY
    const maximumAngle = Math.atan(screenHalfHeight / config.screenDistance)
    const chosenAngle = Math.atan2(verticalDistance, horizontalDistance)
    onSelect(config.kind === 'double-slit' ? clamp(chosenAngle, -maximumAngle, maximumAngle) : chosenAngle)
  }

  const selectedScreenPosition = selectedAngle == null
    ? null
    : config.screenDistance * Math.tan(selectedAngle)
  const selectedScreenY = selectedScreenPosition == null ? null : toY(selectedScreenPosition)
  const selectedHitsScreen = selectedScreenPosition != null && Math.abs(selectedScreenPosition) <= screenHalfHeight
  const selectedMarkerOnScreen = showObservationScreen && selectedHitsScreen
  const selectedTangent = selectedAngle == null ? 0 : Math.tan(selectedAngle)
  const selectedRayLimitX = screenlessGrating ? fieldEndX : config.screenDistance
  const selectedRayEndX = selectedAngle == null || Math.abs(selectedTangent) < 1e-8
    ? selectedRayLimitX
    : Math.min(selectedRayLimitX, (verticalExtent - 0.5) / Math.abs(selectedTangent))
  const selectedRayEndY = selectedRayEndX * selectedTangent
  const primarySelectedSourceIndex = Math.floor(config.sourceCount / 2)
  const selectedWavefrontRays = screenlessGrating && viewMode === 'wavefronts' && selectedAngle != null
    ? sourcePositions.map((sourceY, sourceIndex) => {
        const verticalLimit = verticalExtent - 0.5
        const boundaryEndX = Math.abs(selectedTangent) < 1e-8
          ? selectedRayLimitX
          : selectedTangent > 0
            ? (verticalLimit - sourceY) / selectedTangent
            : (-verticalLimit - sourceY) / selectedTangent
        const endX = clamp(Math.min(selectedRayLimitX, boundaryEndX), 0, selectedRayLimitX)
        return {
          sourceIndex,
          sourceY,
          endX,
          endY: sourceY + endX * selectedTangent,
          primary: sourceIndex === primarySelectedSourceIndex,
        }
      })
    : []
  const primarySelectedRay = selectedWavefrontRays.find((ray) => ray.primary)
  const firstOrderGeometry = (() => {
    if (config.kind !== 'double-slit' || viewMode !== 'wavefronts' || !showFringeGeometry) return null
    if (config.wavelength >= config.spacing) return { possible: false }

    const upperSlitY = config.spacing / 2
    const lowerSlitY = -config.spacing / 2
    const delta = config.wavelength
    const screenY = doubleSlitLocusY(config, delta, config.screenDistance)
    if (screenY == null) return { possible: false }

    const theta = Math.atan2(screenY, config.screenDistance)
    const projectedDelta = config.spacing * Math.sin(theta)
    const footX = projectedDelta * Math.cos(theta)
    const footY = lowerSlitY + projectedDelta * Math.sin(theta)
    const farFieldTheta = Math.asin(config.wavelength / config.spacing)
    const farFieldScreenY = config.screenDistance * Math.tan(farFieldTheta)
    const smallAngleScreenY = config.wavelength * config.screenDistance / config.spacing
    const farFieldError = Math.abs(farFieldScreenY - screenY) / Math.abs(screenY)
    const smallAngleError = Math.abs(smallAngleScreenY - farFieldScreenY) / Math.abs(farFieldScreenY)
    const totalPositionError = Math.abs(smallAngleScreenY - screenY) / Math.abs(screenY)
    const errorPercent = Math.round(totalPositionError * 100)
    let approximationTone = 'good'
    let approximationSummary = `GOOD APPROXIMATION · ${errorPercent}% POSITION ERROR`
    let approximationAdvice = 'The screen is far enough away and θ₁ is small.'
    if (farFieldError > 0.05 && smallAngleError > 0.05) {
      approximationTone = 'warning'
      approximationSummary = `BOTH APPROXIMATIONS ARE WEAK · ${errorPercent}% ERROR`
      approximationAdvice = 'Increase D; then reduce λ or increase s.'
    } else if (farFieldError > 0.05) {
      approximationTone = 'warning'
      approximationSummary = `SCREEN TOO CLOSE FOR PARALLEL RAYS · ${errorPercent}% ERROR`
      approximationAdvice = 'Increase D or reduce slit separation s.'
    } else if (smallAngleError > 0.05) {
      approximationTone = 'warning'
      approximationSummary = `ANGLE TOO LARGE FOR SMALL-ANGLE STEP · ${errorPercent}% ERROR`
      approximationAdvice = 'Reduce λ or increase slit separation s.'
    }
    const arcRadius = 2.1
    const angleArc = Array.from({ length: 25 }, (_, index) => {
      const angle = theta * index / 24
      return (index === 0 ? 'M' : 'L') + toX(arcRadius * Math.cos(angle)).toFixed(2) + ',' + toY(arcRadius * Math.sin(angle)).toFixed(2)
    }).join(' ')
    const direction = [Math.cos(theta), Math.sin(theta)]
    const normal = [-Math.sin(theta), Math.cos(theta)]
    const markerSize = 0.26
    const rightAnglePoints = [
      [footX - direction[0] * markerSize, footY - direction[1] * markerSize],
      [footX - direction[0] * markerSize + normal[0] * markerSize, footY - direction[1] * markerSize + normal[1] * markerSize],
      [footX + normal[0] * markerSize, footY + normal[1] * markerSize],
    ]
    return {
      possible: true,
      theta,
      upperSlitY,
      lowerSlitY,
      footX,
      footY,
      screenY,
      onScreen: Math.abs(screenY) <= screenHalfHeight,
      approximationTone,
      approximationSummary,
      approximationAdvice,
      angleArc,
      rightAnglePath: rightAnglePoints.map((point, index) => (
        (index === 0 ? 'M' : 'L') + toX(point[0]).toFixed(2) + ',' + toY(point[1]).toFixed(2)
      )).join(' '),
    }
  })()
  useLayoutEffect(() => {
    const textGroup = geometryCardTextRef.current
    if (!showFringeGeometry || !textGroup) return
    const bounds = textGroup.getBBox()
    const measuredBounds = {
      width: Math.ceil(bounds.x + bounds.width + 10),
      height: Math.ceil(bounds.y + bounds.height + 6),
    }
    setGeometryCardBounds((current) => (
      current.width === measuredBounds.width && current.height === measuredBounds.height
        ? current
        : measuredBounds
    ))
  }, [showFringeGeometry, firstOrderGeometry?.possible, firstOrderGeometry?.onScreen, firstOrderGeometry?.approximationSummary, firstOrderGeometry?.approximationAdvice])
  const geometryCardScale = 1.5
  const geometryCardWidth = geometryCardBounds.width * geometryCardScale
  const geometryCardHeight = geometryCardBounds.height * geometryCardScale
  const geometryCardBase = {
    x: toX(4.2),
    y: firstOrderGeometry?.possible
      ? height - 119 - 3 * scale
      : height - 86 - 3 * scale,
  }
  const geometryCardPosition = {
    x: clamp(geometryCardBase.x + geometryCardOffset.x, 8, width - geometryCardWidth - 8),
    y: clamp(geometryCardBase.y + geometryCardOffset.y, 8, height - geometryCardHeight - 8),
  }
  const pointerPositionInField = (event) => {
    const svg = fieldRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(matrix.inverse())
  }
  const beginGeometryCardDrag = (event) => {
    const point = pointerPositionInField(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    geometryCardDragRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      offsetX: geometryCardPosition.x - geometryCardBase.x,
      offsetY: geometryCardPosition.y - geometryCardBase.y,
    }
  }
  const moveGeometryCard = (event) => {
    const drag = geometryCardDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = pointerPositionInField(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    const requestedX = geometryCardBase.x + drag.offsetX + point.x - drag.startX
    const requestedY = geometryCardBase.y + drag.offsetY + point.y - drag.startY
    setGeometryCardOffset({
      x: clamp(requestedX, 8, width - geometryCardWidth - 8) - geometryCardBase.x,
      y: clamp(requestedY, 8, height - geometryCardHeight - 8) - geometryCardBase.y,
    })
  }
  const endGeometryCardDrag = (event) => {
    if (geometryCardDragRef.current?.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    geometryCardDragRef.current = null
  }
  const selectedLocus = (() => {
    if (config.kind !== 'double-slit' || selectedAngle == null) return null

    const exactPathDifference = pathDifferenceAtAngle(config, selectedAngle)
    const phaseCycles = exactPathDifference / config.wavelength
    const crestOrder = Math.round(phaseCycles)
    const crestTroughOrder = Math.round(phaseCycles - 0.5) + 0.5
    const crestError = Math.abs(phaseCycles - crestOrder)
    const crestTroughError = Math.abs(phaseCycles - crestTroughOrder)
    const overlapType = crestError <= 0.1
      ? 'crest-crest'
      : crestTroughError <= 0.1
        ? 'crest-trough'
        : null
    if (!overlapType) return null

    const order = overlapType === 'crest-crest' ? crestOrder : crestTroughOrder
    const overlapPathDifference = order * config.wavelength
    if (Math.abs(overlapPathDifference) >= config.spacing) return null

    const sampleCount = 121
    const points = Array.from({ length: sampleCount }, (_, index) => {
      const x = 0.08 + (index / (sampleCount - 1)) * (config.screenDistance - 0.08)
      return { x, y: doubleSlitLocusY(config, overlapPathDifference, x) }
    }).filter((point) => point.y != null)
    if (points.length < 2) return null

    const labelPoint = points[Math.floor(points.length * 0.58)]
    return {
      order,
      overlapType,
      path: points.map((point, index) => (
        (index === 0 ? 'M' : 'L') + toX(point.x).toFixed(2) + ',' + toY(point.y).toFixed(2)
      )).join(' '),
      labelX: toX(labelPoint.x),
      labelY: toY(labelPoint.y) - 10,
      label: overlapType === 'crest-crest'
        ? (order === 0 ? 'Δ = 0 · crest–crest overlap' : 'Δ = ' + formatValue(order) + 'λ · crest–crest overlap')
        : 'Δ = ' + formatValue(order) + 'λ · crest–trough overlap',
    }
  })()
  const bandCount = 260
  const screenBands = Array.from({ length: bandCount }, (_, index) => {
    const y = screenTop + (index / (bandCount - 1)) * screenHeight
    const screenPosition = (centreY - y) / scale
    const angle = Math.atan(screenPosition / config.screenDistance)
    return { y, intensity: interferenceIntensity(config, angle) }
  })
  const wavelengthGuideY = toY(-7.25)
  const wavelengthGuideX = toX(-5.9)
  const separationX = barrierX - 17
  const principalOrderRays = principalOrders.map((order) => {
    const theta = Math.asin(order * config.wavelength / config.spacing)
    const tangent = Math.tan(theta)
    const screenPosition = config.screenDistance * tangent
    const reachesScreen = !screenlessGrating && Math.abs(screenPosition) <= screenHalfHeight
    const endX = screenlessGrating
      ? (Math.abs(tangent) < 1e-8
          ? world.maxX - 0.5
          : Math.min(world.maxX - 0.5, (verticalExtent - 0.5) / Math.abs(tangent)))
      : reachesScreen || Math.abs(tangent) < 1e-8
        ? config.screenDistance
        : screenHalfHeight / Math.abs(tangent)
    return { order, theta, endX, endY: endX * tangent, reachesScreen, screenPosition }
  })
  const activeRay = principalOrderRays.find((ray) => ray.order === activeOrder)
  const angleArcPath = Array.from({ length: 25 }, (_, index) => {
    const theta = activeOrderAngle * index / 24
    return (index === 0 ? 'M' : 'L') + toX(2.15 * Math.cos(theta)).toFixed(2) + ',' + toY(2.15 * Math.sin(theta)).toFixed(2)
  }).join(' ')
  const orderGeometry = (() => {
    if (!screenlessGrating || viewMode !== 'principal-orders' || !showOrderGeometry) return null

    const upperSourceIndex = Math.min(sourcePositions.length - 1, Math.floor(sourcePositions.length / 2) + (sourcePositions.length % 2 === 1 ? 1 : 0))
    const lowerSourceIndex = Math.max(0, upperSourceIndex - 1)
    const upperSourceY = sourcePositions[upperSourceIndex]
    const lowerSourceY = sourcePositions[lowerSourceIndex]
    const directionX = Math.cos(activeOrderAngle)
    const directionY = Math.sin(activeOrderAngle)
    const longerSourceIndex = activeOrderAngle >= 0 ? lowerSourceIndex : upperSourceIndex
    const shorterSourceIndex = longerSourceIndex === lowerSourceIndex ? upperSourceIndex : lowerSourceIndex
    const longerSourceY = sourcePositions[longerSourceIndex]
    const shorterSourceY = sourcePositions[shorterSourceIndex]
    const projectedDistance = Math.abs(config.spacing * directionY)
    const foot = {
      x: projectedDistance * directionX,
      y: longerSourceY + projectedDistance * directionY,
    }
    const projectionVector = { x: -foot.x, y: shorterSourceY - foot.y }
    const projectionLength = Math.max(0.001, Math.hypot(projectionVector.x, projectionVector.y))
    const projectionUnit = { x: projectionVector.x / projectionLength, y: projectionVector.y / projectionLength }
    const markerSize = 0.24
    const rightAnglePath = [
      { x: foot.x - directionX * markerSize, y: foot.y - directionY * markerSize },
      { x: foot.x - directionX * markerSize + projectionUnit.x * markerSize, y: foot.y - directionY * markerSize + projectionUnit.y * markerSize },
      { x: foot.x + projectionUnit.x * markerSize, y: foot.y + projectionUnit.y * markerSize },
    ].map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.x).toFixed(2)},${toY(point.y).toFixed(2)}`).join(' ')

    const tangent = Math.tan(activeOrderAngle)
    const centralFrontX = clamp((activeRay?.endX ?? 7) * 0.42, 2.8, 6.2)
    const centralFrontY = centralFrontX * tangent
    const planeProjection = centralFrontX * directionX + centralFrontY * directionY
    const contactPoint = (sourceY) => {
      const travel = planeProjection - sourceY * directionY
      return { x: travel * directionX, y: sourceY + travel * directionY }
    }
    const upperContact = contactPoint(upperSourceY)
    const lowerContact = contactPoint(lowerSourceY)
    const frontCentre = {
      x: (upperContact.x + lowerContact.x) / 2,
      y: (upperContact.y + lowerContact.y) / 2,
    }
    const frontHalfExtent = Math.max(1.15, config.spacing * 0.9)
    const frontStart = {
      x: frontCentre.x - directionY * frontHalfExtent,
      y: frontCentre.y + directionX * frontHalfExtent,
    }
    const frontEnd = {
      x: frontCentre.x + directionY * frontHalfExtent,
      y: frontCentre.y - directionX * frontHalfExtent,
    }
    const rayEnd = (sourceY) => {
      const verticalLimit = verticalExtent - 0.45
      const endX = Math.abs(tangent) < 1e-8
        ? worldMaxX - 0.5
        : tangent > 0
          ? Math.min(worldMaxX - 0.5, (verticalLimit - sourceY) / tangent)
          : Math.min(worldMaxX - 0.5, (-verticalLimit - sourceY) / tangent)
      return { x: Math.max(0, endX), y: sourceY + Math.max(0, endX) * tangent }
    }
    const upperEnd = rayEnd(upperSourceY)
    const lowerEnd = rayEnd(lowerSourceY)
    return {
      upperSourceIndex,
      lowerSourceIndex,
      upperSourceY,
      lowerSourceY,
      longerSourceY,
      shorterSourceY,
      foot,
      rightAnglePath,
      upperContact,
      lowerContact,
      frontCentre,
      frontStart,
      frontEnd,
      upperEnd,
      lowerEnd,
      projectedDistance,
      orderLabel: activeOrder > 0 ? `+${activeOrder}` : `${activeOrder}`,
    }
  })()

  return (
    <div className="multi-field-wrap" style={{ '--barrier-position': (barrierX / width * 100).toFixed(2) + '%' }}>
      <canvas ref={animationRef} className="multi-field-animation" width={width} height={height} aria-hidden="true" />
      <svg
        ref={fieldRef}
        className="multi-field"
        viewBox={"0 0 " + width + " " + height}
        role="img"
        aria-label={(viewMode === 'principal-orders' ? "Principal diffraction orders showing one cyan common wavefront travelling six wavelengths from the grating, with its contributing circular crests" : viewMode === 'intensity' ? "Interference intensity heatmap" : viewMode === 'instantaneous' ? "Instantaneous resultant displacement heatmap; colour shows direction and brightness shows magnitude" : "Crest and trough wavefront diagram") + (screenlessGrating ? ": angular diffraction field without an observation screen" : ": wavelength, apertures, separation and screen distance all use the same relative units")}
        onClick={choosePoint}
        style={{ '--wave-colour': '#66ddf3' }}
      >
        <defs>
          <linearGradient id={"field-bg-relative-" + config.kind} x1="0" x2="1">
            <stop offset="0" stopColor="#06121c" />
            <stop offset="0.48" stopColor="#0a2130" />
            <stop offset="1" stopColor="#071823" />
          </linearGradient>
          <linearGradient id={"heatmap-key-" + config.kind} x1="0" x2="1">
            <stop offset="0" stopColor="#05111d" />
            <stop offset="1" stopColor="#81f1ff" />
          </linearGradient>
          <linearGradient id={"instantaneous-key-" + config.kind} x1="0" x2="1">
            <stop offset="0" stopColor="#e55748" />
            <stop offset="0.5" stopColor="#05111d" />
            <stop offset="1" stopColor="#55e5ff" />
          </linearGradient>
          <clipPath id={"forward-field-relative-" + config.kind}>
            <rect x={barrierX + 4} y="0" width={Math.max(0, screenX - barrierX - 5)} height={height} />
          </clipPath>
        </defs>
        <rect width={width} height={height} fill="transparent" />
        {viewMode !== 'principal-orders' && viewMode !== 'wavefronts' && (
          <g className="field-grid">
            {gridXs.map((value) => <line key={"v" + value} x1={toX(value)} y1={toY(world.maxY)} x2={toX(value)} y2={toY(world.minY)} />)}
            {gridYs.map((value) => <line key={"h" + value} x1={toX(world.minX)} y1={toY(value)} x2={toX(world.maxX)} y2={toY(value)} />)}
          </g>
        )}

        <g className="wave-direction">
          <line x1={toX(-5.7)} y1={toY(7.6)} x2={toX(-0.8)} y2={toY(7.6)} />
          <path d={"M" + toX(-0.8) + " " + toY(7.6) + "l-9-5v10Z"} />
          <text x={toX(-5.7)} y={toY(7.95)}>incident plane wave</text>
        </g>

        {barrierSegments.map(([segmentStart, segmentEnd], index) => (
          <line className="field-barrier" key={index} x1={barrierX} y1={toY(segmentStart)} x2={barrierX} y2={toY(segmentEnd)} />
        ))}
        {sourcePositions.map((sourceY, index) => (
          <g
            key={index}
            className={sourceHoverEnabled && hoveredSource === index ? 'source-trace-active' : undefined}
          >
            <circle
              className={'field-source' + (config.kind === 'double-slit' && viewMode === 'wavefronts' ? ' phase-visible' : '')}
              cx={barrierX + 2}
              cy={toY(sourceY)}
              r="3.2"
            />
            {viewMode === 'principal-orders' && (
              <text
                className="field-source-label"
                x={barrierX - 9}
                y={toY(sourceY) + 3}
                textAnchor="end"
              >
                {index + 1}
              </text>
            )}
          </g>
        ))}
        {config.kind !== 'double-slit' && (
          <text className="apparatus-label" x={barrierX} y={toY(world.minY + 0.25)} textAnchor="middle">
            {config.sourceCount + " equally spaced slits"}
          </text>
        )}

        {viewMode === 'principal-orders' && (
          <g className="principal-order-construction">
            <line className="zero-axis" x1={barrierX + 3} y1={centreY} x2={toX(Math.min(8, config.screenDistance))} y2={centreY} />
            {principalOrderRays.map((ray) => (
              <g
                key={ray.order}
                className={ray.order === activeOrder ? 'selected-order-ray' : 'other-order-ray'}
              >
                <line
                  className="order-ray-hit"
                  x1={barrierX + 3}
                  y1={centreY}
                  x2={toX(ray.endX)}
                  y2={toY(ray.endY)}
                  tabIndex="0"
                  role="button"
                  aria-label={'Select diffraction order ' + (ray.order > 0 ? '+' : '') + ray.order + (showObservationScreen && !ray.reachesScreen ? ', beyond the screen' : '')}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectOrder?.(ray.order)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectOrder?.(ray.order)
                    }
                  }}
                />
                <line className="order-ray-visible" x1={barrierX + 3} y1={centreY} x2={toX(ray.endX)} y2={toY(ray.endY)} />
                {showObservationScreen && ray.reachesScreen && (
                  <circle
                    className="order-screen-target"
                    cx={screenX}
                    cy={toY(ray.screenPosition)}
                    r={ray.order === activeOrder ? 7 : 4.5}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectOrder?.(ray.order)
                    }}
                  />
                )}
              </g>
            ))}
            <path className="selected-angle-arc" d={angleArcPath} />
            {activeOrder !== 0 && (
              <text className="selected-angle-label" x={toX(2.55 * Math.cos(activeOrderAngle / 2))} y={toY(2.55 * Math.sin(activeOrderAngle / 2))}>
                θ = {formatAngle(activeOrderAngle)}
              </text>
            )}
            {activeRay && (
              <text
                className="aligned-crests-label"
                x={toX(Math.min(activeRay.endX * 0.62, 10))}
                y={toY(Math.min(activeRay.endX * 0.62, 10) * Math.tan(activeOrderAngle)) - 15}
                textAnchor="middle"
              >
                aligned crests · n = {activeOrder > 0 ? '+' : ''}{activeOrder}
              </text>
            )}
          </g>
        )}

        {orderGeometry && (
          <g className="order-geometry-overlay" aria-label={'Path-difference geometry for principal order ' + orderGeometry.orderLabel}>
            <rect className="order-geometry-scrim" x={barrierX + 4} y="0" width={Math.max(0, fieldEndScreenX - barrierX - 4)} height={height} />

            <g className="order-geometry-rays">
              <line x1={barrierX + 3} y1={toY(orderGeometry.upperSourceY)} x2={toX(orderGeometry.upperEnd.x)} y2={toY(orderGeometry.upperEnd.y)} />
              <line x1={barrierX + 3} y1={toY(orderGeometry.lowerSourceY)} x2={toX(orderGeometry.lowerEnd.x)} y2={toY(orderGeometry.lowerEnd.y)} />
            </g>

            <g className="order-geometry-spacing">
              <line className="spacing-side" x1={barrierX - 13} y1={toY(orderGeometry.upperSourceY)} x2={barrierX - 13} y2={toY(orderGeometry.lowerSourceY)} />
              <line className="spacing-cap" x1={barrierX - 18} y1={toY(orderGeometry.upperSourceY)} x2={barrierX - 8} y2={toY(orderGeometry.upperSourceY)} />
              <line className="spacing-cap" x1={barrierX - 18} y1={toY(orderGeometry.lowerSourceY)} x2={barrierX - 8} y2={toY(orderGeometry.lowerSourceY)} />
              <text x={barrierX - 22} y={(toY(orderGeometry.upperSourceY) + toY(orderGeometry.lowerSourceY)) / 2 + 4} textAnchor="end">d</text>
              <circle cx={barrierX + 2} cy={toY(orderGeometry.upperSourceY)} r="5.2" />
              <circle cx={barrierX + 2} cy={toY(orderGeometry.lowerSourceY)} r="5.2" />
            </g>

            {activeOrder !== 0 && (
              <g className="order-geometry-triangle">
                <line
                  className="projection-side"
                  x1={barrierX + 3}
                  y1={toY(orderGeometry.shorterSourceY)}
                  x2={toX(orderGeometry.foot.x)}
                  y2={toY(orderGeometry.foot.y)}
                />
                <line
                  className="extra-path-side"
                  x1={barrierX + 3}
                  y1={toY(orderGeometry.longerSourceY)}
                  x2={toX(orderGeometry.foot.x)}
                  y2={toY(orderGeometry.foot.y)}
                />
                <path className="order-right-angle" d={orderGeometry.rightAnglePath} />
                <text
                  className="extra-path-label"
                  x={(barrierX + toX(orderGeometry.foot.x)) / 2 + 7}
                  y={(toY(orderGeometry.longerSourceY) + toY(orderGeometry.foot.y)) / 2 + (activeOrder > 0 ? 17 : -9)}
                >
                  Δ = d sin θ = {Math.abs(activeOrder)}<tspan className="textbook-lambda">λ</tspan>
                </text>
              </g>
            )}

            <g className="order-geometry-common-front">
              <line x1={toX(orderGeometry.frontStart.x)} y1={toY(orderGeometry.frontStart.y)} x2={toX(orderGeometry.frontEnd.x)} y2={toY(orderGeometry.frontEnd.y)} />
              <circle cx={toX(orderGeometry.upperContact.x)} cy={toY(orderGeometry.upperContact.y)} r="4" />
              <circle cx={toX(orderGeometry.lowerContact.x)} cy={toY(orderGeometry.lowerContact.y)} r="4" />
              <text x={toX(orderGeometry.frontCentre.x) + 11} y={toY(orderGeometry.frontCentre.y) - 12}>common crest</text>
            </g>

            <g className="order-geometry-card" transform={'translate(' + Math.max(barrierX + 75, width - 296) + ' ' + (height - 102) + ')'}>
              <rect width="282" height="88" rx="4" />
              <text className="order-geometry-title" x="13" y="19">PRINCIPAL ORDER · n = {orderGeometry.orderLabel}</text>
              {activeOrder === 0 ? (
                <>
                  <text x="13" y="43">θ = 0°, so Δ = d sin θ = 0</text>
                  <text className="order-geometry-result" x="13" y="67">Every slit sends a crest straight ahead.</text>
                </>
              ) : (
                <>
                  <text x="13" y="41">Adjacent slits differ by Δ = d sin θ</text>
                  <text className="order-geometry-result" x="13" y="62">d sin θ = n<tspan className="textbook-lambda">λ</tspan></text>
                  <text className="order-geometry-note" x="13" y="79">An integer path step keeps every crest aligned.</text>
                </>
              )}
            </g>
          </g>
        )}

        {sourceHoverEnabled && (
          <g className="source-hover-targets">
            {sourcePositions.map((sourceY, index) => (
              <circle
                key={index}
                className="source-hover-target"
                cx={barrierX + 2}
                cy={toY(sourceY)}
                r={viewMode === 'principal-orders' ? 15 : 11}
                tabIndex="0"
                role="button"
                aria-label={'Highlight every moving crest from slit ' + (index + 1)}
                onMouseEnter={() => setHoveredSource(index)}
                onMouseLeave={() => setHoveredSource(null)}
                onFocus={() => setHoveredSource(index)}
                onBlur={() => setHoveredSource(null)}
                onClick={(event) => event.stopPropagation()}
              />
            ))}
          </g>
        )}

        {showObservationScreen && (
          <g className="observation-screen">
            <line x1={screenX} y1={screenTop} x2={screenX} y2={screenBottom} />
            {screenBands.map((band, index) => (
              <rect
                key={index}
                x={screenX + 5}
                y={band.y - screenHeight / bandCount / 2}
                width={4 + band.intensity * 26}
                height={screenHeight / bandCount + 0.35}
                style={{ opacity: 0.08 + band.intensity * 0.92 }}
              />
            ))}
          </g>
        )}

        {firstOrderGeometry && (
          <g className="fringe-geometry-overlay" aria-label="First-order maximum geometry using the path-difference and screen triangles">
            {firstOrderGeometry.possible ? (
              <>
                <g className="fringe-large-triangle">
                  <line className="geometry-denominator" x1={barrierX + 3} y1={centreY} x2={screenX} y2={centreY} />
                  <line className="geometry-numerator" x1={screenX} y1={centreY} x2={screenX} y2={toY(firstOrderGeometry.screenY)} />
                  <line className="geometry-ray" x1={barrierX + 3} y1={centreY} x2={screenX} y2={toY(firstOrderGeometry.screenY)} />
                  <text className="geometry-denominator-label" x={(barrierX + screenX) / 2} y={centreY + 16} textAnchor="middle">D</text>
                  <text className="geometry-numerator-label" x={screenX - 10} y={toY(firstOrderGeometry.screenY / 2)} textAnchor="end">w</text>
                  <path className="geometry-angle" d={firstOrderGeometry.angleArc} />
                  <text className="geometry-angle-label" x={toX(2.35 * Math.cos(firstOrderGeometry.theta / 2))} y={toY(2.35 * Math.sin(firstOrderGeometry.theta / 2)) - 5}>θ₁</text>
                </g>

                <g className="fringe-small-triangle">
                  <line className="geometry-parallel-ray" x1={barrierX + 3} y1={toY(firstOrderGeometry.upperSlitY)} x2={screenX} y2={toY(firstOrderGeometry.screenY)} />
                  <line className="geometry-parallel-ray" x1={barrierX + 3} y1={toY(firstOrderGeometry.lowerSlitY)} x2={screenX} y2={toY(firstOrderGeometry.screenY)} />
                  <line className="geometry-construction" x1={barrierX + 3} y1={toY(firstOrderGeometry.upperSlitY)} x2={toX(firstOrderGeometry.footX)} y2={toY(firstOrderGeometry.footY)} />
                  <line className="geometry-numerator" x1={barrierX + 3} y1={toY(firstOrderGeometry.lowerSlitY)} x2={toX(firstOrderGeometry.footX)} y2={toY(firstOrderGeometry.footY)} />
                  <path className="geometry-right-angle" d={firstOrderGeometry.rightAnglePath} />
                  <text className="geometry-numerator-label" x={(barrierX + toX(firstOrderGeometry.footX)) / 2} y={(toY(firstOrderGeometry.lowerSlitY) + toY(firstOrderGeometry.footY)) / 2 + 30} textAnchor="middle">s sin θ₁ ≈ Δ</text>
                </g>

                <g
                  className="fringe-geometry-equations"
                  transform={"translate(" + geometryCardPosition.x + " " + geometryCardPosition.y + ") scale(" + geometryCardScale + ")"}
                  onPointerDown={beginGeometryCardDrag}
                  onPointerMove={moveGeometryCard}
                  onPointerUp={endGeometryCardDrag}
                  onPointerCancel={endGeometryCardDrag}
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Drag the first-order explanation card to reposition it"
                >
                  <rect width={geometryCardBounds.width} height={geometryCardBounds.height} rx="4" />
                  <line className="geometry-status-divider" x1="12" y1="89" x2={geometryCardBounds.width - 12} y2="89" />
                  <g ref={geometryCardTextRef}>
                    <text className="geometry-title" x="12" y="16">FIRST-ORDER MAXIMUM · SIMILAR TRIANGLES</text>
                    <text x="12" y="34">small triangle:  sin θ₁ = Δ / s</text>
                    <text x="12" y="49">screen triangle:  tan θ₁ = w / D</text>
                    <text x="12" y="64">small angle:  sin θ₁ ≈ tan θ₁</text>
                    <text className="geometry-result" x="12" y="79">Δ = <tspan className="textbook-lambda">λ</tspan>  ⇒  w ≈ <tspan className="textbook-lambda">λ</tspan>D / s{firstOrderGeometry.onScreen ? "" : "  · beyond this screen"}</text>
                    <text className={"geometry-status " + firstOrderGeometry.approximationTone} x="12" y="104">{firstOrderGeometry.approximationSummary}</text>
                    <text className="geometry-guidance" x="12" y="119">{firstOrderGeometry.approximationAdvice}</text>
                  </g>
                </g>
              </>
            ) : (
              <g
                className="fringe-geometry-equations"
                transform={"translate(" + geometryCardPosition.x + " " + geometryCardPosition.y + ") scale(" + geometryCardScale + ")"}
                onPointerDown={beginGeometryCardDrag}
                onPointerMove={moveGeometryCard}
                onPointerUp={endGeometryCardDrag}
                onPointerCancel={endGeometryCardDrag}
                onClick={(event) => event.stopPropagation()}
                aria-label="Drag the first-order explanation card to reposition it"
              >
                <rect width={geometryCardBounds.width} height={geometryCardBounds.height} rx="4" />
                <g ref={geometryCardTextRef}>
                  <text className="geometry-title" x="12" y="16">FIRST-ORDER MAXIMUM</text>
                  <text x="12" y="35">Not possible for these values: <tspan className="textbook-lambda">λ</tspan> &gt; s.</text>
                </g>
              </g>
            )}
          </g>
        )}

        {viewMode !== 'principal-orders' && selectedAngle != null && (config.kind !== 'double-slit' || selectedHitsScreen) && (
          <g className={'field-selection' + (selectedLocus ? ' ' + selectedLocus.overlapType : '')}>
            {config.kind === 'double-slit' ? (
              selectedLocus && (
                <>
                  <path d={selectedLocus.path} />
                  <text className="locus-label" x={selectedLocus.labelX} y={selectedLocus.labelY} textAnchor="middle">
                    {selectedLocus.label}
                  </text>
                </>
              )
            ) : viewMode === 'wavefronts' ? (
              selectedWavefrontRays.map((ray) => (
                <line
                  className={ray.primary ? 'selected-ray-primary' : 'selected-ray-secondary'}
                  key={ray.sourceIndex}
                  x1={barrierX + 3}
                  y1={toY(ray.sourceY)}
                  x2={toX(ray.endX)}
                  y2={toY(ray.endY)}
                />
              ))
            ) : (
              <line x1={barrierX + 3} y1={centreY} x2={toX(selectedRayEndX)} y2={toY(selectedRayEndY)} />
            )}
            {selectedMarkerOnScreen && <circle cx={screenX} cy={selectedScreenY} r="7" />}
            <text
              x={selectedMarkerOnScreen ? screenX - 12 : toX(primarySelectedRay?.endX ?? selectedRayEndX) - 9}
              y={selectedMarkerOnScreen ? selectedScreenY - 11 : toY(primarySelectedRay?.endY ?? selectedRayEndY) + ((primarySelectedRay?.endY ?? selectedRayEndY) >= 0 ? 15 : -9)}
              textAnchor="end"
            >
              {formatAngle(selectedAngle)}{showObservationScreen && !selectedHitsScreen ? ' · off screen' : ''}
            </text>
          </g>
        )}

        <g className="wavelength-dimension">
          <line x1={wavelengthGuideX} y1={wavelengthGuideY} x2={wavelengthGuideX + wavelengthPixels} y2={wavelengthGuideY} />
          <line x1={wavelengthGuideX} y1={wavelengthGuideY - 5} x2={wavelengthGuideX} y2={wavelengthGuideY + 5} />
          <line x1={wavelengthGuideX + wavelengthPixels} y1={wavelengthGuideY - 5} x2={wavelengthGuideX + wavelengthPixels} y2={wavelengthGuideY + 5} />
          <text x={wavelengthGuideX + wavelengthPixels / 2} y={wavelengthGuideY - 8} textAnchor="middle"><tspan className="textbook-lambda">λ</tspan> = {formatValue(config.wavelength)}</text>
        </g>

        {config.kind === 'double-slit' && (
          <g className={"slit-dimensions" + (showFringeGeometry ? " geometry-active" : "")}>
            <line x1={separationX} y1={toY(config.spacing / 2)} x2={separationX} y2={toY(-config.spacing / 2)} />
            <line x1={separationX - 4} y1={toY(config.spacing / 2)} x2={separationX + 4} y2={toY(config.spacing / 2)} />
            <line x1={separationX - 4} y1={toY(-config.spacing / 2)} x2={separationX + 4} y2={toY(-config.spacing / 2)} />
            <text x={separationX - 6} y={centreY + 3} textAnchor="end">s = {formatValue(config.spacing)}</text>
            {!showFringeGeometry && (
              <text x={barrierX + 10} y={toY(config.spacing / 2) - 7}>a = {formatValue(config.slitWidth)}</text>
            )}
          </g>
        )}

        {viewMode === 'wavefronts' ? (
          <g className="phase-key" transform={"translate(" + toX(3) + " " + toY(8.25) + ")"}>
            <line className="crest" x1="0" y1="0" x2="22" y2="0" /><text x="28" y="3">crest</text>
            <line className="trough" x1="76" y1="0" x2="98" y2="0" /><text x="104" y="3">trough</text>
          </g>
        ) : viewMode === 'intensity' ? (
          <g className="heatmap-key" transform={"translate(" + toX(2.8) + " " + toY(8.42) + ")"}>
            <rect x="0" y="0" width="112" height="7" fill={"url(#heatmap-key-" + config.kind + ")"} />
            <text x="0" y="19">low intensity</text><text x="112" y="19" textAnchor="end">high intensity</text>
          </g>
        ) : viewMode === 'instantaneous' ? (
          <g className="heatmap-key" transform={"translate(" + toX(2.8) + " " + toY(8.42) + ")"}>
            <text className="heatmap-key-title" x="0" y="-7">resultant displacement now</text>
            <rect x="0" y="0" width="160" height="8" fill={"url(#instantaneous-key-" + config.kind + ")"} />
            <text x="0" y="20">−A · trough</text><text x="80" y="20" textAnchor="middle">0 · equilibrium</text><text x="160" y="20" textAnchor="end">+A · crest</text>
          </g>
        ) : null}

        {config.kind !== 'double-slit' && (
          <text className="field-caption" x={toX(world.minX) + 4} y={height - 5}>ONE GRID DIVISION = 1 RELATIVE UNIT</text>
        )}
        {!(config.kind === 'double-slit' && viewMode === 'wavefronts') && (
          <text className="field-caption wavefront-note" x={toX(8.1)} y={height - 5}>
            {viewMode === 'principal-orders' ? "ONE CYAN WAVEFRONT · TRACES 6λ FROM THE SLITS · GREEN = ITS CONTRIBUTING CIRCULAR CRESTS" : viewMode === 'intensity' ? "TIME-AVERAGED INTENSITY FROM EXACT PATH LENGTHS" : viewMode === 'instantaneous' ? "SIGNED DISPLACEMENT · BRIGHTNESS = MAGNITUDE · ANIMATED" : "λ, d AND THE WAVEFRONTS USE THE SAME RELATIVE SCALE"}
          </text>
        )}
      </svg>
      {config.kind === 'double-slit' && viewMode === 'wavefronts' && (
        <button
          className={"fringe-geometry-toggle" + (showFringeGeometry ? " active" : "")}
          type="button"
          onClick={onToggleFringeGeometry}
          aria-pressed={showFringeGeometry}
        >
          {showFringeGeometry ? "Hide fringe geometry" : "Show fringe geometry"}
        </button>
      )}
      {screenlessGrating && viewMode === 'principal-orders' && (
        <button
          className={"fringe-geometry-toggle order-geometry-toggle" + (showOrderGeometry ? " active" : "")}
          type="button"
          onClick={onToggleOrderGeometry}
          aria-pressed={showOrderGeometry}
        >
          {showOrderGeometry ? "Hide order geometry" : "Show order geometry"}
        </button>
      )}
      {viewMode === 'principal-orders' && (
        <div className="principal-order-picker" role="group" aria-label="Select a principal diffraction order">
          <span>Principal order, n</span>
          <p>
            <span><i className="wavelet-swatch" />circular crests</span>
            <span><i className="front-swatch" />common front</span>
            <span><i className="contact-swatch" />slits</span>
          </p>
          <div>
            {principalOrders.slice().reverse().map((order) => (
              <button
                key={order}
                className={order === activeOrder ? 'active' : ''}
                type="button"
                onClick={() => onSelectOrder?.(order)}
                aria-pressed={order === activeOrder}
              >
                {order > 0 ? '+' + order : order}
              </button>
            ))}
          </div>
        </div>
      )}
      {farFieldView && (
        <div className="field-zoom-picker" role="group" aria-label="Choose how far the field view extends from the grating">
          <span>Zoom out</span>
          {[1, 2, 4].map((zoom) => (
            <button
              key={zoom}
              className={fieldZoom === zoom ? 'active' : ''}
              type="button"
              onClick={() => onFieldZoom?.(zoom)}
              aria-pressed={fieldZoom === zoom}
            >
              {zoom}×
            </button>
          ))}
        </div>
      )}
      {(farFieldView || viewMode !== 'wavefronts') && (
        <span className="field-scale-note">
          {farFieldView
            ? fieldZoom + "× far-field view · no screen"
            : viewMode === 'principal-orders' ? "Hover a slit to trace all of its moving crests" : viewMode === 'intensity' ? "Intensity heatmap · bright = stronger superposition" : "Displacement now · hue = direction · brightness = magnitude"}
        </span>
      )}
    </div>
  )
}

function InterferenceProfile({ config, selectedAngle, onSelect, selectedOrder = null, expanded = false, angularScale = false, snapToPrincipalOrders = false, highlightOrder = null }) {
  const profileRef = useRef(null)
  const width = 720
  const height = expanded ? 340 : 270
  const left = 48
  const right = 700
  const top = 20
  const bottom = height - 44
  const doubleSlit = config.kind === 'double-slit'
  const halfRange = angularScale ? 90 : config.screenHalfHeight
  const sampleCount = 1201
  const maximumOrder = Math.floor(config.spacing / config.wavelength)
  const baseXValues = Array.from({ length: sampleCount }, (_, index) => -halfRange + (index / (sampleCount - 1)) * halfRange * 2)
  // A many-slit grating produces peaks too narrow for a uniform screen sample to
  // reliably land on their centres. Add the exact order positions and a dense
  // cluster spanning two minima on either side of every visible order.
  const orderXValues = doubleSlit
    ? []
    : Array.from({ length: maximumOrder * 2 + 1 }, (_, index) => index - maximumOrder)
        .flatMap((order) => Array.from({ length: 25 }, (_, sampleIndex) => {
          const fractionalOrder = order + (sampleIndex - 12) / (6 * config.sourceCount)
          const sine = fractionalOrder * config.wavelength / config.spacing
          if (Math.abs(sine) >= 1) return null
          const theta = Math.asin(sine)
          const value = angularScale ? theta * 180 / Math.PI : Math.tan(theta) * config.screenDistance
          return Math.abs(value) <= halfRange ? value : null
        }))
        .filter((value) => value != null)
  const xValues = [...baseXValues, ...orderXValues]
    .sort((first, second) => first - second)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 1e-8)
  const thetaForX = (value) => angularScale ? value * Math.PI / 180 : Math.atan(value / config.screenDistance)
  const intensityValues = xValues.map((value) => interferenceIntensity(config, thetaForX(value)))
  const effectiveApertureWidth = doubleSlit ? config.slitWidth : Math.min(0.45, config.spacing * 0.3)
  const envelopeValues = xValues.map((value) => {
    const theta = thetaForX(value)
    const beta = Math.PI * effectiveApertureWidth * Math.sin(theta) / config.wavelength
    const amplitude = sinc(beta)
    return amplitude * amplitude
  })
  const toX = (value) => left + ((value + halfRange) / (2 * halfRange)) * (right - left)
  const toY = (value) => bottom - value * (bottom - top)
  const linePath = intensityValues.map((value, index) => (
    (index === 0 ? "M" : "L") + toX(xValues[index]).toFixed(2) + "," + toY(value).toFixed(2)
  )).join(" ")
  const areaPath = linePath + " L" + right + "," + bottom + " L" + left + "," + bottom + " Z"
  const envelopePath = envelopeValues
    ? envelopeValues.map((value, index) => (
        (index === 0 ? "M" : "L") + toX(xValues[index]).toFixed(2) + "," + toY(value).toFixed(2)
      )).join(" ")
    : null
  const visibleOrderLimit = doubleSlit
    ? Math.min(maximumOrder, Math.ceil(halfRange * config.spacing / (config.wavelength * config.screenDistance)) + 2)
    : maximumOrder
  const orders = Array.from({ length: visibleOrderLimit * 2 + 1 }, (_, index) => index - visibleOrderLimit)
    .map((order) => {
      let value
      if (doubleSlit) {
        value = doubleSlitLocusY(config, order * config.wavelength, config.screenDistance)
        if (value == null) return null
      } else {
        const sine = order * config.wavelength / config.spacing
        if (Math.abs(sine) > 1) return null
        const theta = Math.asin(sine)
        value = angularScale ? theta * 180 / Math.PI : Math.tan(theta) * config.screenDistance
      }
      return Math.abs(value) <= halfRange ? { order, value } : null
    })
    .filter(Boolean)
  const selectedOrderPoint = !doubleSlit
    ? orders.find(({ order }) => order === selectedOrder) ?? null
    : null
  const geometryPeakPoint = doubleSlit && highlightOrder != null
    ? orders.find(({ order }) => order === highlightOrder) ?? null
    : null
  const geometryPeakHighlight = geometryPeakPoint
    ? (() => {
        const minimumValues = [-0.5, 0.5]
          .map((offset) => doubleSlitLocusY(
            config,
            (geometryPeakPoint.order + offset) * config.wavelength,
            config.screenDistance,
          ))
          .filter((value) => value != null)
        if (minimumValues.length !== 2) return null
        const start = clamp(toX(Math.min(...minimumValues)), left, right)
        const end = clamp(toX(Math.max(...minimumValues)), left, right)
        const angle = thetaForX(geometryPeakPoint.value)
        return {
          centre: toX(geometryPeakPoint.value),
          peakY: toY(interferenceIntensity(config, angle)),
          start,
          width: Math.max(10, end - start),
        }
      })()
    : null
  const selectedIntensity = selectedAngle == null ? 0 : interferenceIntensity(config, selectedAngle)
  const selectedOrderHighlight = selectedOrderPoint && selectedAngle != null && selectedIntensity >= 0.15
    ? (() => {
        const firstMinimumValues = [-1, 1].map((direction) => {
          const sine = (selectedOrderPoint.order + direction / config.sourceCount) * config.wavelength / config.spacing
          if (Math.abs(sine) >= 1) return selectedOrderPoint.value
          const theta = Math.asin(sine)
          return angularScale ? theta * 180 / Math.PI : Math.tan(theta) * config.screenDistance
        })
        const start = clamp(toX(Math.min(...firstMinimumValues)), left, right)
        const end = clamp(toX(Math.max(...firstMinimumValues)), left, right)
        const centre = toX(selectedOrderPoint.value)
        return {
          centre,
          labelX: clamp(centre, left + 58, right - 58),
          start,
          width: Math.max(8, end - start),
        }
      })()
    : null
  const selectedValue = selectedAngle == null
    ? null
    : angularScale ? selectedAngle * 180 / Math.PI : Math.tan(selectedAngle) * config.screenDistance

  const choosePoint = (event) => {
    const rect = profileRef.current.getBoundingClientRect()
    const svgX = ((event.clientX - rect.left) / rect.width) * width
    if (snapToPrincipalOrders) {
      const nearestOrder = orders
        .map(({ order, value }) => ({ order, distance: Math.abs(svgX - toX(value)) }))
        .sort((first, second) => first.distance - second.distance)[0]
      if (!nearestOrder || nearestOrder.distance > 30) return
      const sine = nearestOrder.order * config.wavelength / config.spacing
      if (Math.abs(sine) > 1) return
      onSelect(Math.asin(sine))
      return
    }
    const value = clamp(((svgX - left) / (right - left)) * halfRange * 2 - halfRange, -halfRange, halfRange)
    onSelect(thetaForX(value))
  }

  return (
    <figure className={"multi-profile" + (expanded ? " expanded" : "")}>
      <figcaption>
        <span>
          <strong>{angularScale ? "Far-field intensity" : "Screen intensity"}</strong>
          <small>{angularScale ? "angular distribution · −90° to +90°" : `same ±${formatValue(halfRange)} ${doubleSlit ? 'unit' : 'cm'} screen scale`}</small>
        </span>
        <span>Intensity ∝ amplitude²</span>
      </figcaption>
      <svg
        ref={profileRef}
        viewBox={"0 0 " + width + " " + height}
        onClick={choosePoint}
        role="img"
        aria-label={(angularScale ? "Far-field angular" : "Screen") + " interference intensity profile; click to inspect an observation angle"}
        style={{ '--wave-colour': '#66ddf3' }}
      >
        <defs>
          <linearGradient id={"multi-profile-fill-" + config.kind} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--wave-colour)" stopOpacity="0.42" />
            <stop offset="1" stopColor="var(--wave-colour)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={"selected-order-fill-" + config.kind} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd477" stopOpacity="0.18" />
            <stop offset="1" stopColor="#ffd477" stopOpacity="0.035" />
          </linearGradient>
          {selectedOrderHighlight && (
            <clipPath id={"selected-order-clip-" + config.kind}>
              <rect x={selectedOrderHighlight.start} y={top - 4} width={selectedOrderHighlight.width} height={bottom - top + 8} />
            </clipPath>
          )}
          {geometryPeakHighlight && (
            <clipPath id="fringe-geometry-peak-clip">
              <rect x={geometryPeakHighlight.start} y={top - 4} width={geometryPeakHighlight.width} height={bottom - top + 8} />
            </clipPath>
          )}
        </defs>
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="transparent" />
        <line className="profile-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
        <line className="profile-centre" x1={toX(0)} y1={top} x2={toX(0)} y2={bottom} />
        {angularScale && [-90, -45, 0, 45, 90].map((angle) => (
          <g className="profile-angle-marker" key={angle}>
            <line x1={toX(angle)} y1={bottom} x2={toX(angle)} y2={bottom + 5} />
            <text className="profile-end-label" x={toX(angle)} y={height - 7} textAnchor={angle === -90 ? "start" : angle === 90 ? "end" : "middle"}>
              {angle > 0 ? "+" : angle < 0 ? "−" : ""}{Math.abs(angle)}°
            </text>
          </g>
        ))}
        {selectedOrderHighlight && (
          <g className="selected-order-highlight" aria-label={"Selected principal order n = " + selectedOrderPoint.order}>
            <rect
              className="selected-order-band"
              x={selectedOrderHighlight.start}
              y={top}
              width={selectedOrderHighlight.width}
              height={bottom - top}
              fill={"url(#selected-order-fill-" + config.kind + ")"}
            />
            <line className="selected-order-guide" x1={selectedOrderHighlight.centre} y1={top} x2={selectedOrderHighlight.centre} y2={bottom} />
          </g>
        )}
        {orders.map(({ order, value }) => (
          <g className={'order-marker' + (!doubleSlit && selectedOrderHighlight && order === selectedOrder ? ' active' : '')} key={order}>
            <line x1={toX(value)} y1={bottom} x2={toX(value)} y2={bottom - 10} />
            {(!doubleSlit || order === 0) && (
              <text x={toX(value)} y={bottom + 17} textAnchor="middle">{order === 0 ? "0" : (order > 0 ? "+" : "−") + Math.abs(order)}</text>
            )}
          </g>
        ))}
        <path className="multi-profile-area" d={areaPath} fill={"url(#multi-profile-fill-" + config.kind + ")"} />
        {envelopePath && <path className="envelope-line" d={envelopePath} />}
        <path className="multi-profile-line" d={linePath} />
        {geometryPeakHighlight && (
          <g className="fringe-geometry-profile-peak" aria-label="First-order maximum highlighted">
            <path d={linePath} clipPath="url(#fringe-geometry-peak-clip)" />
            <circle cx={geometryPeakHighlight.centre} cy={geometryPeakHighlight.peakY} r="4.5" />
            <text
              x={geometryPeakHighlight.centre}
              y={Math.max(top + 11, geometryPeakHighlight.peakY - 11)}
              textAnchor="middle"
            >
              +1 · FIRST MAXIMUM
            </text>
          </g>
        )}
        {selectedOrderHighlight && (
          <>
            <path
              className="selected-order-curve"
              d={linePath}
              clipPath={"url(#selected-order-clip-" + config.kind + ")"}
            />
            <g className="selected-order-badge" transform={"translate(" + selectedOrderHighlight.labelX + " 1)"}>
              <rect x="-55" y="0" width="110" height="18" rx="3" />
              <text x="0" y="12.5" textAnchor="middle">
                SELECTED · n = {selectedOrderPoint.order > 0 ? "+" : selectedOrderPoint.order < 0 ? "−" : ""}{Math.abs(selectedOrderPoint.order)}
              </text>
            </g>
          </>
        )}
        {selectedValue != null && Math.abs(selectedValue) <= halfRange && (
          <g className="profile-selection">
            <line x1={toX(selectedValue)} y1={top} x2={toX(selectedValue)} y2={bottom} />
            <circle cx={toX(selectedValue)} cy={toY(interferenceIntensity(config, selectedAngle))} r="5" />
          </g>
        )}
        {!angularScale && (
          <>
            <text className="profile-end-label" x={left} y={height - 7} textAnchor="start">−{formatValue(halfRange)} {doubleSlit ? 'units' : 'cm'}</text>
            <text className="profile-end-label" x={right} y={height - 7} textAnchor="end">+{formatValue(halfRange)} {doubleSlit ? 'units' : 'cm'}</text>
          </>
        )}
      </svg>
      <p>
        {snapToPrincipalOrders
          ? "Click near a principal maximum to select that order."
          : angularScale
            ? "Click the profile to inspect the contributing waves at that angle."
            : "Click the profile to inspect the contributing waves at that point."}
      </p>
    </figure>
  )
}

function PhasorDiagram({ config, selectedAngle }) {
  const phaseStep = 2 * Math.PI * pathDifferenceAtAngle(config, selectedAngle) / config.wavelength
  const scale = Math.min(34, 74 / Math.sqrt(config.sourceCount))
  const points = [{ x: 90, y: 90 }]
  for (let index = 0; index < config.sourceCount; index += 1) {
    const previous = points[points.length - 1]
    points.push({
      x: previous.x + Math.cos(index * phaseStep) * scale,
      y: previous.y - Math.sin(index * phaseStep) * scale,
    })
  }
  const minX = Math.min(...points.map((point) => point.x), 90)
  const maxX = Math.max(...points.map((point) => point.x), 90)
  const minY = Math.min(...points.map((point) => point.y), 90)
  const maxY = Math.max(...points.map((point) => point.y), 90)
  const viewWidth = Math.max(68, maxX - minX + 28)
  const viewHeight = Math.max(68, maxY - minY + 28)

  return (
    <svg className="phasor-diagram" viewBox={(minX - 12) + " " + (minY - 12) + " " + viewWidth + " " + viewHeight} role="img" aria-label={"Tip-to-tail phasor addition for the selected observation " + (config.kind === 'double-slit' ? "point" : "angle")}>
      <circle className="phasor-origin" cx="90" cy="90" r="3" />
      {points.slice(1).map((point, index) => (
        <line className="phasor-component" key={index} x1={points[index].x} y1={points[index].y} x2={point.x} y2={point.y} />
      ))}
      <line className="phasor-resultant" x1="90" y1="90" x2={points[points.length - 1].x} y2={points[points.length - 1].y} />
      <circle className="phasor-tip" cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" />
    </svg>
  )
}

function MultiSourceInspector({ config, selectedAngle, onClose, paused, playbackSpeed }) {
  const [phaseCycles, setPhaseCycles] = useState(0)
  const [isPlaying, setIsPlaying] = useState(!paused)
  const [showPhasors, setShowPhasors] = useState(false)
  const angleInspector = config.kind !== 'double-slit'
  const phaseStepCycles = pathDifferenceAtAngle(config, selectedAngle) / config.wavelength

  useEffect(() => {
    setPhaseCycles(0)
  }, [selectedAngle, config.spacing, config.wavelength, config.sourceCount])

  useEffect(() => {
    if (!isPlaying) return undefined
    let frameId
    let previous = performance.now()
    const advance = (now) => {
      const elapsed = Math.min(60, now - previous)
      if (elapsed >= 45) {
        setPhaseCycles((value) => value + elapsed * 0.0007 * playbackSpeed)
        previous = now
      }
      frameId = requestAnimationFrame(advance)
    }
    frameId = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frameId)
  }, [isPlaying, playbackSpeed])

  const plot = useMemo(() => {
    const width = 820
    const height = 220
    const left = 50
    const right = 800
    const top = 12
    const bottom = 168
    const middleY = (top + bottom) / 2
    const amplitudeScale = (bottom - top) * 0.43
    const offsets = Array.from({ length: 241 }, (_, index) => -1.5 + (index / 240) * 3)
    const toX = (value) => left + ((value + 1.5) / 3) * (right - left)
    const toY = (value) => middleY - value * amplitudeScale
    const envelope = config.kind === 'double-slit'
      ? Math.abs(sinc(Math.PI * config.slitWidth * Math.sin(selectedAngle) / config.wavelength))
      : 1
    const resultant = new Array(offsets.length).fill(0)
    const components = Array.from({ length: config.sourceCount }, (_, sourceIndex) => {
      const values = offsets.map((offset, sampleIndex) => {
        const amplitude = envelope * Math.cos(2 * Math.PI * (offset - phaseCycles - sourceIndex * phaseStepCycles))
        resultant[sampleIndex] += amplitude / config.sourceCount
        return amplitude
      })
      return values.map((value, index) => (
        (index === 0 ? "M" : "L") + toX(offsets[index]).toFixed(2) + "," + toY(value).toFixed(2)
      )).join(" ")
    })
    const resultantPath = resultant.map((value, index) => (
      (index === 0 ? "M" : "L") + toX(offsets[index]).toFixed(2) + "," + toY(value).toFixed(2)
    )).join(" ")
    let real = 0
    let imaginary = 0
    for (let index = 0; index < config.sourceCount; index += 1) {
      const angle = index * phaseStepCycles * 2 * Math.PI
      real += Math.cos(angle)
      imaginary += Math.sin(angle)
    }
    const coherence = Math.hypot(real, imaginary) / config.sourceCount
    const combinedAmplitude = coherence * envelope
    const interference = coherence >= 0.82
      ? { label: "Constructive", className: "constructive" }
      : coherence <= 0.16
        ? { label: "Destructive", className: "destructive" }
        : { label: "Partial interference", className: "partial" }
    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      middleY,
      centreX: toX(0),
      toY,
      components,
      resultantPath,
      resultantAtNow: resultant[120],
      coherence,
      combinedAmplitude,
      interference,
    }
  }, [config, phaseCycles, phaseStepCycles, selectedAngle])

  const adjacentPathDifference = pathDifferenceAtAngle(config, selectedAngle)
  const phaseDegrees = (((phaseStepCycles % 1) + 1) % 1) * 360

  return (
    <section className="inspector-panel multi-source-inspector" aria-labelledby="multi-inspector-title">
      <div className="inspector-graph">
        <div className="interference-plot-scroll">
          <svg className="interference-plot" viewBox={"0 0 " + plot.width + " " + plot.height} role="img" aria-label={angleInspector ? "Time graph of every source contribution and their superposition at a far-field detector in the selected direction" : "Time graph of every source contribution and their superposition at the selected point"}>
            <line className="plot-boundary" x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.bottom} />
            <line className="plot-boundary" x1={plot.right} y1={plot.top} x2={plot.right} y2={plot.bottom} />
            <line className="plot-zero" x1={plot.left} y1={plot.middleY} x2={plot.right} y2={plot.middleY} />
            <line className="plot-selected" x1={plot.centreX} y1={plot.top} x2={plot.centreX} y2={plot.bottom} />
            {plot.components.map((path, index) => <path className="component-wave" d={path} key={index} />)}
            <path className="combined-wave" d={plot.resultantPath} />
            <circle className="combined-point" cx={plot.centreX} cy={plot.toY(plot.resultantAtNow)} r="5" />
            <text className="selected-label" x={plot.centreX} y="191" textAnchor="middle">now · t = 0</text>
            <text className="axis-title" x={(plot.left + plot.right) / 2} y="213" textAnchor="middle">{angleInspector ? "time at a far-field detector in the selected direction" : "time at the selected point"}</text>
            <text className="amplitude-label" x="16" y={plot.middleY} textAnchor="middle" transform={"rotate(-90 16 " + plot.middleY + ")"}>amplitude</text>
          </svg>
        </div>
      </div>

      <aside className="inspector-details">
        <header className="inspector-header">
          <p className="eyebrow">{angleInspector ? "Angle inspector · selected far-field direction" : "Interference at P · selected screen position"}</p>
          <h2 id="multi-inspector-title">{config.sourceCount} coherent waves at {formatAngle(selectedAngle)}</h2>
        </header>
        <div className="inspector-status">
          <span className={"interference-state " + plot.interference.className}>{plot.interference.label}</span>
          <span>{config.kind === 'double-slit' ? 'Path difference' : 'Adjacent path difference'} {formatValue(adjacentPathDifference)} units</span>
          <span>Adjacent phase difference {formatValue(phaseDegrees)}°</span>
          <span>Source alignment {Math.round(plot.coherence * 100)}%</span>
          <span>Combined amplitude {Math.round(plot.combinedAmplitude * 100)}% of the central peak</span>
        </div>
        <div className="inspector-actions">
          <button className="inspector-play" type="button" onClick={() => setIsPlaying((value) => !value)}>
            <IconPlay paused={!isPlaying} />
            <span>{isPlaying ? "Pause graph" : "Play graph"}</span>
            <strong>{formatValue(playbackSpeed)}×</strong>
          </button>
          <button className="inspector-clear" type="button" onClick={onClose}>{angleInspector ? "Clear angle" : "Clear point"}</button>
        </div>
        <div className="interference-legend" aria-label="Plot key">
          <span><i className="component-key" />Individual source contributions</span>
          <span><i className="resultant-key" />Combined wave</span>
        </div>
        <button className="phasor-toggle" type="button" aria-expanded={showPhasors} onClick={() => setShowPhasors((value) => !value)}>
          {showPhasors ? "Hide phasors" : "Show phasors"}
        </button>
        {showPhasors && <PhasorDiagram config={config} selectedAngle={selectedAngle} />}
      </aside>
    </section>
  )
}

function InterferenceInvestigation({ kind, onHome }) {
  const doubleSlit = kind === 'double-slit'
  const [wavelength, setWavelength] = useState(doubleSlit ? 1.15 : 0.65)
  const [spacing, setSpacing] = useState(doubleSlit ? 4.2 : 1.6)
  const [slitWidth, setSlitWidth] = useState(0.8)
  const [screenDistance, setScreenDistance] = useState(doubleSlit ? 18 : 16)
  const [sourceCount, setSourceCount] = useState(7)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [animationStep, setAnimationStep] = useState(0)
  const [fieldZoom, setFieldZoom] = useState(1)
  const [paused, setPaused] = useState(false)
  const [fieldView, setFieldView] = useState(doubleSlit ? 'wavefronts' : 'apparatus-3d')
  const [showFringeGeometry, setShowFringeGeometry] = useState(false)
  const [showOrderGeometry, setShowOrderGeometry] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(doubleSlit ? 0 : 1)
  const [selectedAngle, setSelectedAngle] = useState(null)
  const config = useMemo(() => ({
    kind,
    wavelength,
    spacing,
    slitWidth,
    screenDistance,
    screenHalfHeight: 9.1,
    sourceCount: doubleSlit ? 2 : sourceCount,
  }), [kind, wavelength, spacing, slitWidth, screenDistance, doubleSlit, sourceCount])
  const displayedConfig = useMemo(() => (
    !doubleSlit && fieldView === 'apparatus-3d'
      ? { ...config, sourceCount: 100 }
      : config
  ), [config, doubleSlit, fieldView])
  const pathDifferenceDefaultAngle = useMemo(() => {
    const maximumVisibleAngle = Math.atan(config.screenHalfHeight / config.screenDistance)
    const firstOrderAngle = config.wavelength < config.spacing
      ? Math.asin(config.wavelength / config.spacing)
      : maximumVisibleAngle * 0.68
    return Math.min(firstOrderAngle, maximumVisibleAngle * 0.88)
  }, [config.screenDistance, config.screenHalfHeight, config.spacing, config.wavelength])
  const displayedSelectedAngle = doubleSlit && fieldView === 'path-difference'
    ? selectedAngle ?? pathDifferenceDefaultAngle
    : selectedAngle
  const usesAngularFarField = !doubleSlit && fieldView !== 'apparatus-3d'
  const fringeSpacing = config.wavelength * screenDistance / config.spacing
  const nudgeFrameCount = wavelength <= 1 ? 2 : 4
  const maximumOrder = Math.floor(config.spacing / config.wavelength)
  const positiveOrders = Array.from({ length: maximumOrder }, (_, index) => index + 1)
  const title = doubleSlit ? "Double-slit interference" : "Diffraction grating"
  const summary = doubleSlit
    ? "Follow two coherent waves from their real slit positions to the screen. Every displayed length now uses the same relative scale."
    : "Extend the same scaled geometry to many equally spaced coherent slits. Reinforcement survives only at particular angles, producing sharp principal maxima."

  useEffect(() => {
    if (!doubleSlit) setSelectedOrder((current) => clamp(current, -maximumOrder, maximumOrder))
  }, [doubleSlit, maximumOrder])

  useEffect(() => {
    if (!doubleSlit && fieldView === 'apparatus-3d' && wavelength > 1.2) {
      setWavelength(1.2)
      setSelectedAngle(null)
    }
  }, [doubleSlit, fieldView, wavelength])

  const updateSeparation = (value) => {
    setSpacing(value)
    setSlitWidth((current) => Math.min(current, value * 0.55))
    setSelectedAngle(null)
  }

  const updateGeometry = (setter) => (value) => {
    setter(value)
    setSelectedAngle(null)
  }

  const updateScreenDistance = (value) => {
    if (doubleSlit && fieldView === 'path-difference') {
      const fixedScreenY = screenDistance * Math.tan(displayedSelectedAngle)
      setScreenDistance(value)
      setSelectedAngle(Math.atan2(clamp(fixedScreenY, -config.screenHalfHeight, config.screenHalfHeight), value))
      return
    }
    setScreenDistance(value)
    setSelectedAngle(null)
  }

  const selectAngle = (angle) => {
    setSelectedAngle(angle)
    if (!doubleSlit) {
      const nearestOrder = Math.round(config.spacing * Math.sin(angle) / config.wavelength)
      setSelectedOrder(clamp(nearestOrder, -maximumOrder, maximumOrder))
    }
  }

  const selectFieldAngle = (angle) => {
    if (!doubleSlit) {
      selectAngle(angle)
      return
    }

    const phaseCycles = pathDifferenceAtAngle(config, angle) / config.wavelength
    const crestOrder = Math.round(phaseCycles)
    const troughOrder = Math.round(phaseCycles - 0.5) + 0.5
    const crestError = Math.abs(phaseCycles - crestOrder)
    const troughError = Math.abs(phaseCycles - troughOrder)
    const snappedOrder = crestError <= 0.1
      ? crestOrder
      : troughError <= 0.1
        ? troughOrder
        : null

    if (snappedOrder == null) {
      setSelectedAngle(angle)
      return
    }

    const snappedPathDifference = snappedOrder * config.wavelength
    const snappedScreenY = doubleSlitLocusY(config, snappedPathDifference, config.screenDistance)
    if (snappedScreenY == null || Math.abs(snappedScreenY) > config.screenHalfHeight) {
      setSelectedAngle(angle)
      return
    }
    setSelectedAngle(Math.atan2(snappedScreenY, config.screenDistance))
  }

  const selectPrincipalOrder = (order) => {
    setSelectedOrder(order)
    setSelectedAngle(Math.asin(order * config.wavelength / config.spacing))
  }

  return (
    <main className="explorer-page investigation-page">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={onHome} aria-label="Back to all investigations">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Wave Interference Explorer</span>
        </button>
        <span className="curriculum-tag">{title}</span>
      </header>

      <section className="investigation-intro">
        <div>
          <p className="eyebrow">{doubleSlit ? "Two coherent sources" : "Many coherent sources"}</p>
          <h1>{title}</h1>
        </div>
        <p>{summary}</p>
      </section>

      <section className="multi-shell" aria-label={title + " interactive investigation"}>
        <div className="multi-toolbar">
          <RangeControl
            id={kind + "-wavelength"}
            label="Wavelength, λ"
            value={wavelength}
            min={doubleSlit ? 0.5 : 0.38}
            max={doubleSlit ? 4.5 : fieldView === 'apparatus-3d' ? 1.2 : 2.5}
            step={!doubleSlit && fieldView === 'apparatus-3d' ? "0.01" : "0.05"}
            displayValue={doubleSlit ? null : Math.round(wavelength * 1000)}
            unit={doubleSlit ? " units" : " nm"}
            onChange={updateGeometry(setWavelength)}
          />
          {doubleSlit ? (
            <>
              <RangeControl id="slit-separation" label="Slit separation, s" value={spacing} min="1" max="14" step="0.1" unit=" units" onChange={updateSeparation} />
              <RangeControl id="slit-width" label="Slit width, a" value={slitWidth} min="0.3" max={Math.min(2.4, spacing * 0.55)} step="0.05" unit=" units" onChange={updateGeometry(setSlitWidth)} />
              <RangeControl id="screen-distance" label="Screen distance, D" value={screenDistance} min="10" max="24" step="0.5" unit=" units" onChange={updateScreenDistance} />
            </>
          ) : (
            <>
              <RangeControl id="grating-spacing" label={`d · ${Math.round(1000 / spacing)} lines mm⁻¹`} value={spacing} min="1.1" max="3" step="0.05" unit=" μm" onChange={updateGeometry(setSpacing)} />
              <RangeControl
                id="illuminated-slits"
                label={fieldView === 'apparatus-3d' ? "Illuminated lines, N · fixed" : "Slits in model, N"}
                value={fieldView === 'apparatus-3d' ? 100 : sourceCount}
                min="3"
                max={fieldView === 'apparatus-3d' ? 100 : 9}
                step="1"
                unit=""
                onChange={updateGeometry(setSourceCount)}
                disabled={fieldView === 'apparatus-3d'}
              />
              <RangeControl id="grating-screen-distance" label="Screen distance, D" value={screenDistance} min="10" max="22" step="0.5" unit=" cm" onChange={updateGeometry(setScreenDistance)} disabled={usesAngularFarField} />
            </>
          )}
          <RangeControl id={kind + "-speed"} label="Animation speed" value={playbackSpeed} min="0.25" max="2" step="0.25" unit="×" onChange={setPlaybackSpeed} disabled={fieldView === 'intensity'} />
          <div className="animation-actions">
            <button className="icon-button multi-pause" type="button" disabled={fieldView === 'intensity'} onClick={() => setPaused((value) => !value)}>
              <IconPlay paused={paused || fieldView === 'intensity'} />
              <span>{fieldView === 'intensity' ? "Static" : paused ? "Play" : "Pause"}</span>
            </button>
            {paused && doubleSlit && fieldView !== 'intensity' && (
              <button
                className="icon-button animation-nudge"
                type="button"
                onClick={() => setAnimationStep((current) => current + 1)}
                aria-label={`Advance the wave animation by ${nudgeFrameCount} frames`}
                title={`Advance ${nudgeFrameCount} frames`}
              >
                <IconNudge />
                <span>Nudge</span>
              </button>
            )}
          </div>
        </div>

        <div className="multi-display-bar">
          <span className="control-label">Field view</span>
          <div className={'view-switcher multi-view-switcher ' + (doubleSlit ? 'four-options' : 'five-options')} role="group" aria-label="Choose field representation">
            {!doubleSlit && <button className={fieldView === 'apparatus-3d' ? 'active' : ''} type="button" onClick={() => setFieldView('apparatus-3d')}>Apparatus 3D</button>}
            {!doubleSlit && <button className={fieldView === 'principal-orders' ? 'active' : ''} type="button" onClick={() => setFieldView('principal-orders')}>Principal orders</button>}
            <button className={fieldView === 'wavefronts' ? 'active' : ''} type="button" onClick={() => setFieldView('wavefronts')}>Wavefronts</button>
            {doubleSlit && <button className={fieldView === 'path-difference' ? 'active' : ''} type="button" onClick={() => setFieldView('path-difference')}>Path difference</button>}
            <button className={fieldView === 'instantaneous' ? 'active' : ''} type="button" onClick={() => setFieldView('instantaneous')}>{doubleSlit ? 'Displacement' : 'Field'}</button>
            <button className={fieldView === 'intensity' ? 'active' : ''} type="button" onClick={() => setFieldView('intensity')}>Intensity</button>
          </div>
          <p>
            {fieldView === 'apparatus-3d'
              ? "Rotate the apparatus and select an order to see its common outgoing wavefront moving towards the matching screen maximum."
              : fieldView === 'principal-orders'
                ? "Choose n and follow one common wavefront for six wavelengths. It fades at the end, then a new front begins at the grating."
              : fieldView === 'path-difference'
                ? "Follow the phase along two paths to one direction. The extra distance Δ determines whether crests reinforce or cancel."
              : fieldView === 'instantaneous'
              ? "The signed resultant displacement now: coral is negative, cyan is positive, and brightness shows the magnitude."
              : fieldView === 'intensity'
                ? "Time-averaged intensity: bright regions deliver more energy; dark regions are cancellation."
                : "A phase construction showing solid crests and dashed troughs from every slit."}
          </p>
        </div>

        <div className="multi-grid">
          {!doubleSlit && fieldView === 'apparatus-3d' ? (
            <GratingApparatus3D
              config={displayedConfig}
              selectedOrder={selectedOrder}
              onSelectOrder={selectPrincipalOrder}
              paused={paused}
              playbackSpeed={playbackSpeed}
            />
          ) : doubleSlit && fieldView === 'path-difference' ? (
            <PathDifferenceField
              config={config}
              selectedAngle={displayedSelectedAngle}
              onSelect={selectAngle}
              paused={paused}
              playbackSpeed={playbackSpeed}
              stepSignal={animationStep}
              stepFrameCount={nudgeFrameCount}
              showFringeGeometry={showFringeGeometry}
              onToggleFringeGeometry={() => setShowFringeGeometry((current) => !current)}
            />
          ) : (
            <MultiSlitField
              config={config}
              selectedAngle={displayedSelectedAngle}
              onSelect={selectFieldAngle}
              paused={paused}
              playbackSpeed={playbackSpeed}
              stepSignal={animationStep}
              stepFrameCount={nudgeFrameCount}
              viewMode={fieldView}
              selectedOrder={selectedOrder}
              onSelectOrder={selectPrincipalOrder}
              fieldZoom={fieldZoom}
              onFieldZoom={setFieldZoom}
              showFringeGeometry={showFringeGeometry}
              onToggleFringeGeometry={() => {
                if (!showFringeGeometry) setSelectedAngle(null)
                setShowFringeGeometry((current) => !current)
              }}
              showOrderGeometry={showOrderGeometry}
              onToggleOrderGeometry={() => setShowOrderGeometry((current) => !current)}
            />
          )}
          <aside className="pattern-panel">
            <InterferenceProfile
              config={displayedConfig}
              selectedAngle={displayedSelectedAngle}
              onSelect={selectAngle}
              selectedOrder={doubleSlit ? null : selectedOrder}
              angularScale={usesAngularFarField}
              snapToPrincipalOrders={!doubleSlit && fieldView === 'principal-orders'}
              highlightOrder={doubleSlit && fieldView === 'wavefronts' && showFringeGeometry ? 1 : null}
            />
            <div className="equation-panel">
              <p className="eyebrow">{doubleSlit ? "Fringe model" : "Grating equation"}</p>
              {doubleSlit ? (
                <>
                  <div className="equation">Δ = r₂ − r₁</div>
                  <div className="equation equation-secondary">far screen: Δ ≈ s sin θ</div>
                  <div className="equation">w ≈ <span className="textbook-lambda">λ</span>D / s</div>
                  <dl>
                    <div><dt>Fringe spacing</dt><dd>{formatValue(fringeSpacing)} units</dd></div>
                    <div><dt>Central maximum</dt><dd>θ = 0°</dd></div>
                    <div><dt>Slit envelope</dt><dd>set by a/λ</dd></div>
                  </dl>
                  <p className="effect-copy">Increase λ or D to spread the fringes out; increase s to bring them closer together. Increasing a narrows the diffraction envelope.</p>
                </>
              ) : (
                <>
                  <div className="equation">d sin θ = n<span className="textbook-lambda">λ</span></div>
                  <dl>
                    <div><dt>Slit spacing, d</dt><dd>{formatValue(config.spacing)} μm</dd></div>
                    <div><dt>Line density</dt><dd>{Math.round(1000 / config.spacing)} lines mm⁻¹</dd></div>
                    <div><dt>Highest possible order</dt><dd>n = {maximumOrder}</dd></div>
                    <div><dt>Resolving power</dt><dd>R = n × {displayedConfig.sourceCount}</dd></div>
                  </dl>
                  <div className="order-list" aria-label="Positive diffraction order angles">
                    {positiveOrders.length ? positiveOrders.map((order) => (
                      <span key={order}>n = {order}<strong>{formatAngle(Math.asin(order * config.wavelength / config.spacing))}</strong></span>
                    )) : <span>No first-order maximum is possible</span>}
                  </div>
                  <p className="effect-copy">{fieldView === 'apparatus-3d' ? "The apparatus view fixes N = 100 illuminated lines. Reducing d means a greater line density, separating the orders more widely." : "Increasing N sharpens each principal maximum. Reducing d means a greater line density, separating the orders more widely but potentially reducing how many are possible."}</p>
                </>
              )}
            </div>
          </aside>
        </div>

        {!doubleSlit && (fieldView === 'apparatus-3d' || fieldView === 'principal-orders') ? null : displayedSelectedAngle == null ? (
          <div className="selection-prompt">
            {doubleSlit
              ? "Select a point in the wave field or intensity profile to inspect the contributing waves."
              : "Select an angle in the wave field or far-field intensity profile to inspect the contributing waves."}
          </div>
        ) : (
          <MultiSourceInspector
            config={displayedConfig}
            selectedAngle={displayedSelectedAngle}
            onClose={() => setSelectedAngle(null)}
            paused={paused}
            playbackSpeed={playbackSpeed}
          />
        )}
      </section>

      <section className="module-principles">
        <article>
          <span>01</span>
          <h2>{doubleSlit ? "Path difference changes with angle" : "Adjacent slits have a fixed path step"}</h2>
          <p>{doubleSlit ? "At the centre, both paths are equal. This scaled view calculates the two path lengths exactly; s sin θ is the far-screen approximation." : "At angle θ, every neighbouring pair differs in path length by d sin θ."}</p>
        </article>
        <article>
          <span>02</span>
          <h2>{doubleSlit ? "Phase decides bright or dark" : "All N waves must line up"}</h2>
          <p>{doubleSlit ? "Whole-wavelength path differences reinforce; half-wavelength differences cancel." : "Principal maxima occur when the adjacent path difference is an integer number of wavelengths."}</p>
        </article>
        <article>
          <span>03</span>
          <h2>{doubleSlit ? "Finite slits add diffraction" : "More slits sharpen the maxima"}</h2>
          <p>{doubleSlit ? "The two-slit fringes sit inside a single-slit diffraction envelope controlled by the slit width." : "Between principal maxima, the many contributions spread around the phasor diagram and mostly cancel."}</p>
        </article>
      </section>

      <footer>
        <button className="footer-home" type="button" onClick={onHome}>← Choose another investigation</button>
      </footer>
    </main>
  )
}

function ModuleArtwork({ type }) {
  if (type === 'double-slit') {
    return (
      <svg viewBox="0 0 320 210" role="img" aria-label="Plane waves passing through two slits and interfering">
        <defs>
          <linearGradient id="double-slit-wash" x1="0" x2="1">
            <stop offset="0" stopColor="#071b2a" />
            <stop offset="1" stopColor="#102d47" />
          </linearGradient>
        </defs>
        <rect width="320" height="210" fill="url(#double-slit-wash)" />
        <g className="art-faint-wave">
          <path d="M30 28v154M53 28v154M76 28v154" />
        </g>
        <g className="art-barrier">
          <path d="M124 18v56M124 88v34M124 136v56" />
        </g>
        <g className="art-dot">
          <circle cx="125" cy="81" r="4" />
          <circle cx="125" cy="129" r="4" />
        </g>
        <g className="art-wave">
          <path d="M125 58a23 23 0 0 1 0 46M125 42a39 39 0 0 1 0 78M125 26a55 55 0 0 1 0 110" />
          <path d="M125 106a23 23 0 0 1 0 46M125 90a39 39 0 0 1 0 78M125 74a55 55 0 0 1 0 110" />
        </g>
        <g className="art-screen">
          <path d="M286 18v174" />
          <path d="M280 48h12M276 74h20M271 105h30M276 136h20M280 162h12" />
        </g>
      </svg>
    )
  }

  if (type === 'diffraction-grating') {
    return (
      <svg viewBox="0 0 320 210" role="img" aria-label="Parallel waves passing through a diffraction grating">
        <defs>
          <linearGradient id="grating-wash" x1="0" x2="1">
            <stop offset="0" stopColor="#0d1832" />
            <stop offset="1" stopColor="#18234d" />
          </linearGradient>
        </defs>
        <rect width="320" height="210" fill="url(#grating-wash)" />
        <g className="art-faint-wave">
          <path d="M28 34v142M50 34v142M72 34v142" />
        </g>
        <g className="art-grating">
          <path d="M121 18v20M121 48v20M121 78v20M121 108v20M121 138v20M121 168v24" />
        </g>
        <g className="art-dot">
          <circle cx="122" cy="43" r="3.5" /><circle cx="122" cy="73" r="3.5" />
          <circle cx="122" cy="103" r="3.5" /><circle cx="122" cy="133" r="3.5" /><circle cx="122" cy="163" r="3.5" />
        </g>
        <g className="art-ray">
          <path d="M125 43 284 18M125 73l159-9M125 103h159M125 133l159 13M125 163l159 29" />
        </g>
        <g className="art-screen"><path d="M286 12v186" /><path d="M279 18h14M275 64h22M268 103h36M275 146h22M279 192h14" /></g>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 320 210" role="img" aria-label="Wavelets spreading from points across a single aperture">
      <defs>
        <linearGradient id="huygens-wash" x1="0" x2="1">
          <stop offset="0" stopColor="#071d29" />
          <stop offset="1" stopColor="#0c3541" />
        </linearGradient>
      </defs>
      <rect width="320" height="210" fill="url(#huygens-wash)" />
      <g className="art-faint-wave"><path d="M28 30v150M51 30v150M74 30v150" /></g>
      <g className="art-barrier"><path d="M124 18v65M124 127v65" /></g>
      <g className="art-dot">
        <circle cx="125" cy="88" r="3" /><circle cx="125" cy="97" r="3" /><circle cx="125" cy="106" r="3" />
        <circle cx="125" cy="115" r="3" /><circle cx="125" cy="124" r="3" />
      </g>
      <g className="art-wave">
        <path d="M125 77a28 28 0 0 1 0 56M125 59a46 46 0 0 1 0 92M125 41a64 64 0 0 1 0 128M125 23a82 82 0 0 1 0 164" />
      </g>
      <path className="art-resultant" d="M182 42c31 19 48 39 48 63s-17 44-48 63" />
    </svg>
  )
}

function LandingPage({ onOpen }) {
  return (
    <main className="landing-page">
      <div className="landing-content">
        <header className="landing-header">
          <span className="landing-mark" aria-hidden="true"><i /><i /><i /></span>
          <h1>Wave Interference Explorer</h1>
          <p>Choose an investigation</p>
        </header>

        <div className="module-grid" aria-label="Wave investigations">
          {MODULES.map((module) => (
            <button
              className={`module-card module-card-${module.id}`}
              style={{ '--module-accent': module.accent }}
              type="button"
              onClick={() => onOpen(module.id)}
              key={module.id}
            >
              <span className="module-art"><ModuleArtwork type={module.id} /></span>
              <span className="module-copy">
                <strong>{module.title}</strong>
                <small>{module.description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

function App() {
  const readModule = () => {
    const requested = window.location.hash.replace('#', '')
    return MODULES.some((module) => module.id === requested) ? requested : 'home'
  }
  const [activeModule, setActiveModule] = useState(readModule)

  useEffect(() => {
    const syncWithHash = () => setActiveModule(readModule())
    window.addEventListener('hashchange', syncWithHash)
    return () => window.removeEventListener('hashchange', syncWithHash)
  }, [])

  useEffect(() => {
    const title = activeModule === 'home'
      ? 'Wave Interference Explorer'
      : `${MODULES.find((module) => module.id === activeModule)?.title} · Wave Interference Explorer`
    document.title = title
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeModule])

  const openModule = (id) => {
    window.location.hash = id
    setActiveModule(id)
  }

  const openHome = () => {
    window.history.pushState(null, '', window.location.pathname + window.location.search)
    setActiveModule('home')
  }

  if (activeModule === 'home') return <LandingPage onOpen={openModule} />
  if (activeModule === 'huygens') return <HuygensExplorer onHome={openHome} />

  return <InterferenceInvestigation key={activeModule} kind={activeModule} onHome={openHome} />
}

export default App
