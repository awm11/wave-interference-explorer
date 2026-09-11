import { useEffect, useMemo, useRef, useState } from 'react'

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
        glow.addColorStop(0.5, 'rgba(98, 225, 255, 0.72)')
        glow.addColorStop(1, 'rgba(61, 216, 255, 0)')
        context.fillStyle = glow
        context.fillRect(x - 6, 0, 12, height)
        context.strokeStyle = 'rgba(190, 244, 255, 0.75)'
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
              const angularEnvelope = Math.abs(sinc(Math.PI * apertureToWavelength * sineTheta))
              const amplitude = transmissionAmplitude * angularEnvelope

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
        context.lineWidth = sourceTotal > 25 ? 0.65 : 0.9
        const maxRadius = Math.hypot(width - barrierX, height)
        for (const source of sources) {
          for (let radius = phase + wavelength * 0.36; radius < maxRadius; radius += wavelength) {
            const fade = clamp(1 - radius / maxRadius, 0.06, 0.65)
            context.strokeStyle = `rgba(125, 231, 255, ${fade * (sourceTotal > 25 ? 0.12 : 0.18)})`
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
        <span className="curriculum-tag">Huygens’ wavelets · A-level Physics</span>
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

      <footer>
        <span>Built around the common UK A-level treatment of diffraction.</span>
        <span className="footer-links">
          <a href="https://www.aqa.org.uk/subjects/physics/a-level/physics-7408/specification/subject-content/waves" target="_blank" rel="noreferrer">AQA Waves</a>
          <a href="https://qualifications.pearson.com/content/dam/pdf/A%20Level/Physics/2015/Specification%20and%20sample%20assessments/pearsonedexcel-alevel-physics-spec.pdf" target="_blank" rel="noreferrer">Edexcel Physics</a>
          <a href="https://www.ocr.org.uk/Images/171726-specification-accredited-a-level-gce-physics-a-h556.pdf" target="_blank" rel="noreferrer">OCR Physics A</a>
        </span>
      </footer>
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

function MultiSlitField({ config, selectedAngle, onSelect, paused, playbackSpeed, viewMode, selectedOrder = 0, onSelectOrder, fieldZoom = 1, onFieldZoom }) {
  const animationRef = useRef(null)
  const phaseRef = useRef(0)
  const principalTraceRef = useRef(0)
  const constructionVisibilityRef = useRef(1)
  const fieldRef = useRef(null)
  const [hoveredSource, setHoveredSource] = useState(null)
  const sourceHoverEnabled = viewMode === 'principal-orders' || viewMode === 'wavefronts'
  const width = 900
  const height = 510
  const screenlessGrating = config.kind !== 'double-slit'
  const farFieldView = config.kind !== 'double-slit' && (viewMode === 'instantaneous' || viewMode === 'intensity')
  const activeFieldZoom = farFieldView ? fieldZoom : 1
  const baseVerticalExtent = Math.max(9.5, (config.sourceCount - 1) * config.spacing / 2 + 0.9)
  const verticalExtent = baseVerticalExtent * activeFieldZoom
  const padding = 18
  const worldMinX = -6.5
  const requestedFieldEndX = farFieldView ? config.screenDistance * activeFieldZoom : config.screenDistance
  const baseWorldMaxX = farFieldView ? Math.max(24.5, requestedFieldEndX + 2.5) : 24.5
  const horizontalDrawingWidth = farFieldView ? width : width - padding * 2
  const scale = Math.min(
    horizontalDrawingWidth / (baseWorldMaxX - worldMinX),
    (height - padding * 2) / (verticalExtent * 2),
  )
  const worldMaxX = farFieldView
    ? Math.max(baseWorldMaxX, worldMinX + width / scale)
    : baseWorldMaxX
  const world = { minX: worldMinX, maxX: worldMaxX, minY: -verticalExtent, maxY: verticalExtent }
  const fieldEndX = farFieldView || screenlessGrating ? worldMaxX : config.screenDistance
  const contentWidth = (world.maxX - world.minX) * scale
  const originX = farFieldView
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
          ? 'rgba(102, 221, 243, 0.62)'
          : (isTrough ? 'rgba(102, 221, 243, 0.34)' : 'rgba(102, 221, 243, 0.62)')
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
            context.strokeStyle = sourceIsHovered
              ? (isTrough ? 'rgba(255, 255, 255, 0.62)' : 'rgba(255, 255, 255, 0.78)')
              : (isTrough ? 'rgba(102, 221, 243, 0.13)' : 'rgba(102, 221, 243, 0.2)')
            context.lineWidth = sourceIsHovered ? 0.9 : 1.25
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
  }, [paused, playbackSpeed, viewMode, hoveredSource, activeOrderAngle, activeFieldZoom, fieldEndX, fieldEndScreenX, config.kind, config.wavelength, config.spacing, config.slitWidth, config.sourceCount, config.screenDistance, config.screenHalfHeight])

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
  const rulerY = height - 17
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
        {viewMode !== 'principal-orders' && (
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
              className="field-source"
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
        <text className="apparatus-label" x={barrierX} y={toY(world.minY + 0.25)} textAnchor="middle">
          {config.kind === 'double-slit' ? "two slits" : config.sourceCount + " equally spaced slits"}
        </text>

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
            <text className="apparatus-label" x={screenX} y={screenBottom + 17} textAnchor="middle">
              screen · {formatValue(screenHalfHeight * 2)} units high
            </text>
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

        {!screenlessGrating && (
          <g className="scale-ruler">
            <line x1={barrierX} y1={rulerY} x2={screenX} y2={rulerY} />
            <line x1={barrierX} y1={rulerY - 6} x2={barrierX} y2={rulerY + 6} />
            <line x1={screenX} y1={rulerY - 6} x2={screenX} y2={rulerY + 6} />
            <text x={(barrierX + screenX) / 2} y={rulerY - 7} textAnchor="middle">D = {formatValue(config.screenDistance)} units</text>
          </g>
        )}

        <g className="wavelength-dimension">
          <line x1={wavelengthGuideX} y1={wavelengthGuideY} x2={wavelengthGuideX + wavelengthPixels} y2={wavelengthGuideY} />
          <line x1={wavelengthGuideX} y1={wavelengthGuideY - 5} x2={wavelengthGuideX} y2={wavelengthGuideY + 5} />
          <line x1={wavelengthGuideX + wavelengthPixels} y1={wavelengthGuideY - 5} x2={wavelengthGuideX + wavelengthPixels} y2={wavelengthGuideY + 5} />
          <text x={wavelengthGuideX + wavelengthPixels / 2} y={wavelengthGuideY - 8} textAnchor="middle">λ = {formatValue(config.wavelength)}</text>
        </g>

        {config.kind === 'double-slit' && (
          <g className="slit-dimensions">
            <line x1={separationX} y1={toY(config.spacing / 2)} x2={separationX} y2={toY(-config.spacing / 2)} />
            <line x1={separationX - 4} y1={toY(config.spacing / 2)} x2={separationX + 4} y2={toY(config.spacing / 2)} />
            <line x1={separationX - 4} y1={toY(-config.spacing / 2)} x2={separationX + 4} y2={toY(-config.spacing / 2)} />
            <text x={separationX - 6} y={centreY + 3} textAnchor="end">s = {formatValue(config.spacing)}</text>
            <text x={barrierX + 10} y={toY(config.spacing / 2) - 7}>a = {formatValue(config.slitWidth)}</text>
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

        <text className="field-caption" x={toX(world.minX) + 4} y={height - 5}>ONE GRID DIVISION = 1 RELATIVE UNIT</text>
        <text className="field-caption wavefront-note" x={toX(8.1)} y={height - 5}>
          {viewMode === 'principal-orders' ? "ONE CYAN WAVEFRONT · TRACES 6λ FROM THE SLITS · GREEN = ITS CONTRIBUTING CIRCULAR CRESTS" : viewMode === 'intensity' ? "TIME-AVERAGED INTENSITY FROM EXACT PATH LENGTHS" : viewMode === 'instantaneous' ? "SIGNED DISPLACEMENT · BRIGHTNESS = MAGNITUDE · ANIMATED" : config.kind === 'double-slit' ? "λ, a, s, D AND SCREEN USE THE SAME SCALE" : "λ, d AND THE WAVEFRONTS USE THE SAME RELATIVE SCALE"}
        </text>
      </svg>
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
      <span className="field-scale-note">
        {farFieldView
          ? fieldZoom + "× far-field view · no screen"
          : viewMode === 'principal-orders' ? "Hover a slit to trace all of its moving crests" : viewMode === 'intensity' ? "Intensity heatmap · bright = stronger superposition" : viewMode === 'instantaneous' ? "Displacement now · hue = direction · brightness = magnitude" : "Dynamically similar wave model · no magnified inset"}
      </span>
    </div>
  )
}

function InterferenceProfile({ config, selectedAngle, onSelect, selectedOrder = null, expanded = false, angularScale = false, snapToPrincipalOrders = false }) {
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
          <p className="eyebrow">{angleInspector ? "Angle inspector · selected far-field direction" : "Point inspector · fixed observation point"}</p>
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
  const [fieldZoom, setFieldZoom] = useState(1)
  const [paused, setPaused] = useState(false)
  const [fieldView, setFieldView] = useState(doubleSlit ? 'wavefronts' : 'apparatus-3d')
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
  const usesAngularFarField = !doubleSlit && fieldView !== 'apparatus-3d'
  const fringeSpacing = config.wavelength * screenDistance / config.spacing
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

  const selectAngle = (angle) => {
    setSelectedAngle(angle)
    if (!doubleSlit) {
      const nearestOrder = Math.round(config.spacing * Math.sin(angle) / config.wavelength)
      setSelectedOrder(clamp(nearestOrder, -maximumOrder, maximumOrder))
    }
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
        <span className="curriculum-tag">{title} · A-level Physics</span>
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
              <RangeControl id="screen-distance" label="Screen distance, D" value={screenDistance} min="10" max="22" step="0.5" unit=" units" onChange={updateGeometry(setScreenDistance)} />
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
          <button className="icon-button multi-pause" type="button" disabled={fieldView === 'intensity'} onClick={() => setPaused((value) => !value)}>
            <IconPlay paused={paused || fieldView === 'intensity'} />
            <span>{fieldView === 'intensity' ? "Static" : paused ? "Play" : "Pause"}</span>
          </button>
        </div>

        <div className="multi-display-bar">
          <span className="control-label">Field view</span>
          <div className={'view-switcher multi-view-switcher' + (!doubleSlit ? ' five-options' : '')} role="group" aria-label="Choose field representation">
            {!doubleSlit && <button className={fieldView === 'apparatus-3d' ? 'active' : ''} type="button" onClick={() => setFieldView('apparatus-3d')}>Apparatus 3D</button>}
            {!doubleSlit && <button className={fieldView === 'principal-orders' ? 'active' : ''} type="button" onClick={() => setFieldView('principal-orders')}>Principal orders</button>}
            <button className={fieldView === 'wavefronts' ? 'active' : ''} type="button" onClick={() => setFieldView('wavefronts')}>Wavefronts</button>
            <button className={fieldView === 'instantaneous' ? 'active' : ''} type="button" onClick={() => setFieldView('instantaneous')}>{doubleSlit ? 'Displacement' : 'Field'}</button>
            <button className={fieldView === 'intensity' ? 'active' : ''} type="button" onClick={() => setFieldView('intensity')}>Intensity</button>
          </div>
          <p>
            {fieldView === 'apparatus-3d'
              ? "Rotate the apparatus and select an order to see its common outgoing wavefront moving towards the matching screen maximum."
              : fieldView === 'principal-orders'
                ? "Choose n and follow one common wavefront for six wavelengths. It fades at the end, then a new front begins at the grating."
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
          ) : (
            <MultiSlitField
              config={config}
              selectedAngle={selectedAngle}
              onSelect={selectAngle}
              paused={paused}
              playbackSpeed={playbackSpeed}
              viewMode={fieldView}
              selectedOrder={selectedOrder}
              onSelectOrder={selectPrincipalOrder}
              fieldZoom={fieldZoom}
              onFieldZoom={setFieldZoom}
            />
          )}
          <aside className="pattern-panel">
            <InterferenceProfile
              config={displayedConfig}
              selectedAngle={selectedAngle}
              onSelect={selectAngle}
              selectedOrder={doubleSlit ? null : selectedOrder}
              angularScale={usesAngularFarField}
              snapToPrincipalOrders={!doubleSlit && fieldView === 'principal-orders'}
            />
            <div className="equation-panel">
              <p className="eyebrow">{doubleSlit ? "Fringe model" : "Grating equation"}</p>
              {doubleSlit ? (
                <>
                  <div className="equation">Δ = r₂ − r₁</div>
                  <div className="equation equation-secondary">far screen: Δ ≈ s sin θ</div>
                  <div className="equation">w ≈ λD / s</div>
                  <dl>
                    <div><dt>Fringe spacing</dt><dd>{formatValue(fringeSpacing)} units</dd></div>
                    <div><dt>Central maximum</dt><dd>θ = 0°</dd></div>
                    <div><dt>Slit envelope</dt><dd>set by a/λ</dd></div>
                  </dl>
                  <p className="effect-copy">Increase λ or D to spread the fringes out; increase s to bring them closer together. Increasing a narrows the diffraction envelope.</p>
                </>
              ) : (
                <>
                  <div className="equation">d sin θ = nλ</div>
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

        {!doubleSlit && (fieldView === 'apparatus-3d' || fieldView === 'principal-orders') ? null : selectedAngle == null ? (
          <div className="selection-prompt">
            {doubleSlit
              ? "Select a point in the wave field or intensity profile to inspect the contributing waves."
              : "Select an angle in the wave field or far-field intensity profile to inspect the contributing waves."}
          </div>
        ) : (
          <MultiSourceInspector
            config={displayedConfig}
            selectedAngle={selectedAngle}
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
        <span>Built around the common UK A-level treatment of waves and superposition.</span>
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
