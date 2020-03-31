const stateInitialize = {
  path: [],
  history: [],
  historyIndex: 0,
  activePoint: null,
  framesPerSecond: 24,
  strokeWidth: 3,
  gridSnapSize: 10,
  gridSnapOn: true,
  selectDistance: 10,
  pointRadius: 6,
  backgroundImage:
    'https://cdn.pixabay.com/photo/2018/07/14/07/58/cat-3537115_960_720.jpg',
  placeholderPath: `M 162 71 L 92 555 L 176 544 L 218 342 L 288 347 L 239 563 L 340 544 L 425 68 L 332 91 L 301 285 L 215 276 L 268 60 L 162 71 Z M 438 536 L 496 310 L 556 299 L 539 550 L 438 536 Z M 502 232 Q 514 204 543 199 Q 585 199 572 234 Q 562 265 528 267 Q 497 267 502 232 Z M 711 101 L 711 562 Q 830 435 861 381 Q 931 553 990 572 Q 988 293 1090 122 L 1039 79 Q 932 356 947 411 L 877 278 Q 785 411 759 407 L 782 65 L 711 101 Z M 1073 472 Q 1083 363 1152 364 Q 1250 363 1221 459 Q 1200 546 1140 554 Q 1061 566 1073 472 Z M 1131 509 Q 1169 514 1184 465 Q 1204 407 1156 404 Q 1123 407 1110 448 Q 1095 505 1131 509 Z M 1252 548 L 1280 358 L 1324 358 L 1316 398 Q 1381 358 1432 389 L 1417 433 Q 1359 399 1311 445 L 1311 445 L 1289 546 L 1252 548 Z M 1497 99 L 1450 553 L 1510 546 Q 1542 188 1544 144 Q 1515 125 1497 99 Z M 1599 426 Q 1554 467 1575 499 Q 1604 559 1736 535 L 1748 117 L 1700 136 L 1698 398 Q 1645 395 1599 426 Z M 1624 453 Q 1706 407 1704 479 Q 1705 526 1635 504 Q 1587 478 1624 453 Z`,
  highlightedPath: '',
  decimals: 0,
  zoomFactor: 0.4,
  drawPointType: 'Q',
  showAllPointMarkers: true,
  fillPath: true
}

const mouseInitialize = {
  left: {
    down: false,
    from: {
      x: null,
      y: null
    }
  },
  right: {
    down: false,
    from: {
      x: null,
      y: null
    }
  },
  x: 0,
  y: 0,
  unitPx: null,
  nearby: [],
  highlightIndex: null,
  lastSelectedIndex: null
}

let mouse, state

// initialize state and app
const initialize = () => {
  // reset mouse and state
  mouse = JSON.parse(JSON.stringify(mouseInitialize))
  state = JSON.parse(JSON.stringify(stateInitialize))

  // listen to events
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('wheel', handleMouseWheel, { passive: false })

  // set styles using js state
  setJsBasedStyles()

  // initial empty history
  updateHistory()

  // hi world shape as demonstration
  loadInitialPlaceholder()

  // load placeholder image as demonstration
  loadBackgroundImage(state.backgroundImage, true)

  // start rendering
  renderLoop()
}

/* -------------------------------------------------------------------------- */
/*                                 render loop                                */
/* -------------------------------------------------------------------------- */
const renderLoop = async () => {
  // update rendered path
  window.svgPath.setAttribute('d', makePath())

  // update selected & highlighted vertex circles
  updateHighlightedPoint()
  updateSelectedPoint()

  // delay
  await new Promise(r => setTimeout(r, 1000 / state.framesPerSecond))

  // keep printing path text on top of svg
  window.datadiv.innerHTML = '\n'
  window.datadiv.innerHTML += `
    left click      \t- to start drawing
    left drag       \t- to curve while drawing
    right click     \t- to cancel selection or complete shape
    right drag      \t- pan/shift path
    mouse wheel     \t- scale path up/down around mouse ("w" to zoom fit)
    direction      \t- opposite path directions create shape fill openings

    "c"   - copy svg path to clipboard
    "v"   - clear/load image url from clipboard (jpg/png)
              (now: ${state.backgroundImage || 'none'})
    "z"   - undo
    "y"   - redo
    "q"   - clear everything
    "g"   - toggle grid snap (now ${state.gridSnapOn})
    "d"   - delete selected point
    "a"   - add new point on top of selected
    "w"   - resize path to fit viewscreen
    "t"   - cycle selected or point type (selected: ${
      state.path[mouse.lastSelectedIndex]
        ? state.path[mouse.lastSelectedIndex].type
        : 'n/a'
    }) (drawing: ${state.drawPointType})
    "m"   - toggle showing all path point markers
    "+-" - increase/decrease decimal places used in path (0-5, now ${
      state.decimals
    })
`

  window.datadiv.innerHTML += '\n\n' + state.highlightedPath // window.svgPath.getAttribute('d')

  // keep getting focus for keyboard events
  // (this works but makes it near impossible to edit codepen)
  // window.focus()

  // loop forever
  window.requestAnimationFrame(() => renderLoop())
}

/* -------------------------------------------------------------------------- */
/*                                 mouse down                                 */
/* -------------------------------------------------------------------------- */

const handleMouseDown = e => {
  const { button } = e
  handleMouseMove(e, { down: true })

  /* ----------------- cancel drawing point via right click ----------------- */

  if (button === RIGHT_MOUSE_BUTTON) {
    let len = state.path.length
    console.log('MOUSE DOWN: cancel drawing point via right click')

    // change current point to Q & Z if it's the very last point
    if (state.activePoint === len - 1) {
      // find last M
      let previousM = state.activePoint
      while ((previousM--, state.path[previousM].type !== 'M'));

      state.path[state.activePoint] = {
        type: state.drawPointType,
        x: state.path[previousM].x,
        y: state.path[previousM].y,
        xC: state.path[previousM].x,
        yC: state.path[previousM].y,
        isCurved: false
      }
      state.path[state.activePoint + 1] = { type: 'Z' }
    }

    // if this point is right after M, it is not even a line so erase both
    if (
      // state.path[len - 1].type === 'Z' &&
      state.path[len - 2].type === 'M'
    ) {
      state.path.pop()
      state.path.pop()
      state.path.pop()
    }
    // unselect active point and individual selections
    state.activePoint = null
    mouse.lastSelectedIndex = null
    return handleMouseMove(e, { down: true })
  }

  /* ----------------- make selected index actively moving ----------------- */

  if (
    mouse.left.down && // left button is down
    mouse.nearby.length >= 1 && // at least 1 node nearby
    mouse.nearby.indexOf(mouse.lastSelectedIndex) > -1 && // selected node is one of nearby's
    state.activePoint === null // no actively moving node
  ) {
    console.log('MOUSE DOWN: actively move selected index')
    state.activePoint = mouse.lastSelectedIndex // actively moving node index
    return handleMouseMove(e, { down: true })
  }
}

/* -------------------------------------------------------------------------- */
/*                                  mouse up                                  */
/* -------------------------------------------------------------------------- */

const handleMouseUp = e => {
  const { button } = e
  updateMousePosition(e, { up: true })

  const selectedPoint = state.path[mouse.lastSelectedIndex]
  const isControlPointNearby = selectedPoint
    ? (mouse.x - selectedPoint.xC) ** 2 + (mouse.y - selectedPoint.yC) ** 2 <
      state.selectDistance ** 2
    : null

  const isDrawing =
    state.activePoint !== null
      ? state.path.length - 1 === state.activePoint
      : false

  /* -------------------------- select existing point ------------------------- */
  // allows selection of an existing point but need extra click to move it
  if (
    button === LEFT_MOUSE_BUTTON && // left button was just brought up
    mouse.nearby.length >= 1 && // at least 1 node nearby
    state.activePoint === null // no actively moving node
  ) {
    console.log('MOUSE UP: select existing point')
    // pick random of nearby points each click
    let rndNearbyIndex = Math.floor(Math.random() * mouse.nearby.length)
    let rndNearbyPathPointIndex = mouse.nearby[rndNearbyIndex]
    // state.activePoint = rndNearbyPathPointIndex
    mouse.lastSelectedIndex = rndNearbyPathPointIndex
    // finalize
    // handleMouseMove(e, { up: true })
    return undefined
  }

  /* ------------------- start or continue creating point ------------------- */
  if (
    (!selectedPoint || isDrawing) && // nothing is selected outside drawing mode
    (!isControlPointNearby || isDrawing) && // not near control point outside drawing mode
    button === LEFT_MOUSE_BUTTON && // lmb used
    !mouse.right.down && // rmb not down
    mouse.nearby.length === 0 // no nearby points
  ) {
    console.log('MOUSE UP: start or continue creating point')
    // if no active point (not drawing yet), move svg pen there first
    if (state.activePoint === null) {
      state.path.push({ type: 'M', x: mouse.x, y: mouse.y })
    }
    // either way makes line to next point AND becomes the active point
    state.path.push({
      type: state.drawPointType,
      x: mouse.x,
      y: mouse.y,
      xC: null,
      yC: null,
      isCurved: false
    })
    state.activePoint = state.path.length - 1
    mouse.lastSelectedIndex = state.activePoint
    handleMouseMove(e, { up: true })
    updateHistory()
    return undefined
  }

  /* ------------------- cancel moving point on left click ---------------- */

  if (!mouse.left.down && state.activePoint !== null && !isDrawing) {
    console.log('MOUSE UP: cancel active moving point on left click')
    // remove it from active index and take off edit mode & filled render ok
    state.activePoint = null // remove from active but keep it in lastSelected as last selection
    handleMouseMove(e, { up: true })
    updateHistory()
    return undefined
  }

  /* --------------- cancel selected point on left click ------------------ */

  if (
    !mouse.left.down && // left mouse button not down
    state.activePoint === null && // no actively moving point
    !isControlPointNearby && // no control point nearby
    mouse.nearby.length === 0 && // no points nearby
    !isDrawing // edit mode (not drawing)
  ) {
    console.log('MOUSE UP: cancel selected point on left click')
    // remove it from active index and take off edit mode & filled render ok
    mouse.lastSelectedIndex = null // remove selected point
    handleMouseMove(e, { up: true })
    updateHistory()
    return undefined
  }
}

/* -------------------------------------------------------------------------- */
/*                                 mouse wheel                                */
/* -------------------------------------------------------------------------- */

let mouseWheelTimer = null,
  delayWheel = 50,
  historyTimer = null,
  delayHistory = 2000

const handleMouseWheel = e => {
  const { deltaY } = e

  // zoom in or out based on direction of wheel movement
  const attemptZooming = deltaY => {
    zoomShape({
      centerX: mouse.x,
      centerY: mouse.y,
      deltaScale: deltaY < 0 ? state.zoomFactor : -state.zoomFactor
    })
  }

  // call zoom function & mark timer as busy until after delay
  if (!mouseWheelTimer) {
    attemptZooming(deltaY)
    mouseWheelTimer = setTimeout(() => {
      mouseWheelTimer = null
    }, delayWheel)
  }

  // try not to back up zoom states often
  if (!historyTimer) {
    historyTimer = setTimeout(() => {
      updateHistory()
      historyTimer = null
    }, delayHistory)
  }
  // ideally prevent embedded page scrolling
  e.preventDefault()
}

/* -------------------------------------------------------------------------- */
/*                                mouse moving                                */
/* -------------------------------------------------------------------------- */

// what to show during mouse move
const handleMouseMove = (e, { down = false, up = false } = {}) => {
  // update mouse positions
  updateMousePosition(e, { down, up })

  // keep track of nearby points to select
  if (state.activePoint === null) {
    checkNearbyVertex()
    // return undefined
  }

  const wasLeftDraggedFarEnough =
    mouse.left.from.x === null
      ? false
      : (mouse.x - mouse.left.from.x) ** 2 +
          (mouse.y - mouse.left.from.y) ** 2 >
        state.selectDistance ** 2

  const wasRightDraggedFarEnough =
    mouse.right.from.x === null
      ? false
      : (mouse.x - mouse.right.from.x) ** 2 +
          (mouse.y - mouse.right.from.y) ** 2 >
        state.selectDistance ** 2

  // if there's an active point keep updating it based on mouse pos
  const active = state.path[state.activePoint]
  const nextToActive = active ? state.path[state.activePoint + 1] : null
  const isNextZ = nextToActive ? nextToActive.type === 'Z' : null
  // const previousToActive = state.path[state.activePoint - 1]
  const selected = state.path[mouse.lastSelectedIndex]

  // find preceeding M for this active
  let previousIndexM = active ? state.activePoint : null
  if (active) while (state.path[--previousIndexM].type !== 'M');
  const previousM = active ? state.path[previousIndexM] : null

  /* ------------------------- actively moving points ------------------------- */

  const isDrawing = active ? state.path.length - 1 === state.activePoint : false

  // if moving last point before Z, move M before Z as well
  // because last point connects to M on cancel
  if (active && isNextZ && previousM) {
    previousM.x = mouse.x
    previousM.y = mouse.y
  }

  // move active simple x/y points to mouse location
  if (active && isSinglePointType(active.type)) {
    // active.type = active.type
    active.x = mouse.x
    active.y = mouse.y
  }

  if (active && isDoublePointType(active.type)) {
    // mouse dragged far enough?
    // const wasLeftDraggedFarEnough =
    //   (mouse.x - mouse.left.from.x) ** 2 + (mouse.y - mouse.left.from.y) ** 2 >
    //   state.selectDistance ** 2

    // move active end-point to mouse location
    // if (wasLeftDraggedFarEnough) {
    active.x = mouse.x
    active.y = mouse.y
    // }

    // if just created, set control point to current location
    if (active.xC === null) {
      active.xC = mouse.x
      active.yC = mouse.y
    }

    // if is not curved move control point to specific point
    if (isDrawing && !mouse.left.down && !active.isCurved) {
      active.xC = mouse.x
      active.yC = mouse.y
    }

    // if drawing && not just created and lmb is down, curve it by freezing control point to lmb's from xy
    if (isDrawing && mouse.left.down) {
      // to avoid mistakes in drawing mode, make sure it was dragged far enough during drawing
      if (wasLeftDraggedFarEnough) {
        active.xC = mouse.left.from.x
        active.yC = mouse.left.from.y
        active.isCurved = true
      }
    }

    // if dragging in edit mode, mark as curved
    if (!isDrawing && mouse.left.down) {
      active.isCurved = true
    }
  }

  /* ----------------------- for control points in edit mode ------------------- */

  // while LMB down, move selected control point instead of selected point
  if (
    !up && // only dragging counts
    !down && // only dragging counts
    !active && // when end point is not being dragged
    !isDrawing && // when in edit mode, not drawing
    selected && // a point needs to be selected to show control point
    mouse.left.down && // lmb needs to be already down
    isDoublePointType(selected.type) // point needs to be of type to have control point
  ) {
    // loose proximity of mouse to control point
    const isControlPointAroundMouse =
      (mouse.x - selected.xC) ** 2 + (mouse.y - selected.yC) ** 2 <
      100 * state.selectDistance ** 2
    // tight proximity of mouse to control point
    const isControlPointNearMouse =
      (mouse.x - selected.xC) ** 2 + (mouse.y - selected.yC) ** 2 <
      4 * state.selectDistance ** 2
    // mouse closer to end point than control
    const isMouseCloserToEndPoint =
      (mouse.x - selected.xC) ** 2 + (mouse.y - selected.yC) ** 2 >
      (mouse.x - selected.x) ** 2 + (mouse.y - selected.y) ** 2
    // is control point near endpoint
    const isControlPointNearEndPoint =
      (selected.x - selected.xC) ** 2 + (selected.y - selected.yC) ** 2 <
      4 * state.selectDistance ** 2

    // make control point follow mouse
    if (
      isControlPointAroundMouse && // if it's even remotely close to mouse
      !isMouseCloserToEndPoint // if mouse is closer to control point than end point
    ) {
      selected.xC = mouse.x
      selected.yC = mouse.y
      selected.isCurved = true // dragging control should render it curved
    }
    // if mouse is point is near both control point AND end point
    // move control point on top of end point to convert to basic line
    if (isControlPointNearMouse && isControlPointNearEndPoint) {
      selected.xC = selected.x
      selected.yC = selected.y
      selected.isCurved = false
    }
  }

  /* ----------------------- right mouse button dragging ---------------------- */
  if (
    wasRightDraggedFarEnough && // dragged beyond error margin
    !active && // no moving pts
    !isDrawing // not drawing mode
  ) {
    if (mouse.right.down) {
      // pan shape by dragged amount
      if (mouse.right.from.x !== null) {
        panShape({
          deltaX: mouse.x - mouse.right.from.x,
          deltaY: mouse.y - mouse.right.from.y
        })
      }
      window.datadiv.style.cursor = 'grab'
    }
    // try not to back up zoom states often
    if (!historyTimer) {
      historyTimer = setTimeout(() => {
        updateHistory()
        historyTimer = null
      }, delayHistory)
    }
  }
  // reset reference positions if done
  if (up) {
    panShape({ stop: true })
    window.datadiv.style.cursor = 'default'
  }
}

// handle x/y assignments
const updateMousePosition = (e, { down = false, up = false } = {}) => {
  const { button } = e
  mouse.x = state.gridSnapOn
    ? Math.round(e.x / state.gridSnapSize) * state.gridSnapSize
    : e.x
  mouse.y = state.gridSnapOn
    ? Math.round(e.y / state.gridSnapSize) * state.gridSnapSize
    : e.y
  if (down && button === LEFT_MOUSE_BUTTON) {
    mouse.left.down = true
    mouse.left.from.x = mouse.x
    mouse.left.from.y = mouse.y
  }
  if (down && button === RIGHT_MOUSE_BUTTON) {
    mouse.right.down = true
    mouse.right.from.x = mouse.x
    mouse.right.from.y = mouse.y
  }

  if (up && button === LEFT_MOUSE_BUTTON) {
    mouse.left.down = false
    mouse.left.from.x = null
    mouse.left.from.y = null
  }
  if (up && button === RIGHT_MOUSE_BUTTON) {
    mouse.right.down = false
    mouse.right.from.x = null
    mouse.right.from.y = null
  }
}

// puts indecies of nearby points into an array mouse.nearby[]
const checkNearbyVertex = () => {
  let nearby = [],
    toMouseDistanceSq,
    cutoffSq = state.selectDistance ** 2,
    point,
    closestSq = Infinity,
    closestIndex = 0

  for (let i = 0; i < state.path.length; i++) {
    point = state.path[i]
    // for types M L with coordinates
    // check proximity to mouse
    if (point.type !== 'Z' && point.type !== 'M') {
      toMouseDistanceSq = (mouse.x - point.x) ** 2 + (mouse.y - point.y) ** 2
      if (toMouseDistanceSq < cutoffSq) nearby.push(i)
      else continue
      // also check which is closest to highlight
      if (toMouseDistanceSq < closestSq) {
        closestIndex = i
        closestSq = toMouseDistanceSq
      }
    }
  }
  if (nearby.length) {
    // move circle to possible selections near cursor
    mouse.highlightIndex = closestIndex
  } else {
    mouse.highlightIndex = null
  }
  mouse.nearby = nearby
}

// place highlight circle to visualize nearby points
const updateHighlightedPoint = () => {
  let circle = window.highlightCircle

  if (mouse.highlightIndex !== null && state.path[mouse.highlightIndex]) {
    circle.setAttribute('cx', state.path[mouse.highlightIndex].x)
    circle.setAttribute('cy', state.path[mouse.highlightIndex].y)
    circle.setAttribute('r', state.pointRadius)
  } else {
    circle.setAttribute('r', 0)
  }
}

// place selected circle to visualize selected point
const updateSelectedPoint = () => {
  const circle = window.selectionCircle
  const controlCircle = window.controlCircle
  const controlPath1 = window.controlPath1
  const controlPath2 = window.controlPath2
  const selectedPoint = state.path[mouse.lastSelectedIndex]

  // actual point selected
  if (mouse.lastSelectedIndex !== null && selectedPoint) {
    circle.setAttribute('cx', selectedPoint.x)
    circle.setAttribute('cy', selectedPoint.y)
    circle.setAttribute('r', state.pointRadius)
  } else {
    circle.setAttribute('r', 0)
  }

  // the control point and lines for 1 extra control point needed
  if (
    mouse.lastSelectedIndex !== null &&
    selectedPoint &&
    isDoublePointType(selectedPoint.type)
  ) {
    // control point (invisible mid-point)
    controlCircle.setAttribute('cx', selectedPoint.xC)
    controlCircle.setAttribute('cy', selectedPoint.yC)
    controlCircle.setAttribute('r', state.pointRadius)
    // path to point before and after
    const beforeSelectedPoint = state.path[mouse.lastSelectedIndex - 1]
    let controlPath1Value = ''
    let controlPath2Value = ''
    if (beforeSelectedPoint)
      controlPath1Value += `M ${selectedPoint.xC} ${selectedPoint.yC} L ${beforeSelectedPoint.x} ${beforeSelectedPoint.y}`

    controlPath2Value += `M ${selectedPoint.xC} ${selectedPoint.yC} L ${selectedPoint.x} ${selectedPoint.y}`
    controlPath1.setAttribute('d', controlPath1Value)
    controlPath2.setAttribute('d', controlPath2Value)
  } else {
    // hide control circle and path
    controlCircle.setAttribute('r', 0)
    controlPath1.setAttribute('d', '')
    controlPath2.setAttribute('d', '')
  }
}

// set style of paths to fill or not
const setJsBasedStyles = () => {
  // drawing shapes css
  if (state.fillPath)
    updateHeader(
      `path { fill: var(--fillColor); stroke-width: ${state.strokeWidth};}`,
      'for_path'
    )
  else
    updateHeader(
      `path { fill: none; stroke-width: ${state.strokeWidth};}`,
      'for_path'
    )

  // control point visual guide lines
  window.controlPath1.setAttribute('stroke-dasharray', state.pointRadius)
  window.controlPath2.setAttribute('stroke-dasharray', state.pointRadius)
  window.controlPath1.setAttribute('stroke-dashoffset', state.pointRadius)
  window.controlPath2.setAttribute('stroke-dashoffset', state.pointRadius)

  if (state.showAllPointMarkers) {
    window.markerdot.setAttribute('fill', 'var(--strokeColor)')
  } else {
    window.markerdot.setAttribute('fill', 'transparent')
  }

  // check initial grid setting
  checkGridSnap()
}

/* -------------------------------------------------------------------------- */
/*                          creates path from points                          */
/* -------------------------------------------------------------------------- */

const makePath = () => {
  let path = ''
  state.highlightedPath = ''

  for (let i = 0; i < state.path.length; i++) {
    const point = state.path[i]
    const d = v => v.toFixed(state.decimals)
    let thisSegment = ''

    // close shape point
    if (point.type === 'Z') thisSegment += `${point.type} `
    //
    // xy only types
    else if (isSinglePointType(point.type))
      thisSegment += `${point.type} ${d(point.x)} ${d(point.y)} `
    //
    // for non-curved Q type draw as L (others can't guarantee line shape)
    else if (!point.isCurved && point.type === 'Q')
      thisSegment += `L ${d(point.x)} ${d(point.y)} `
    //
    // for the rest xy and xCyC point types draw both points
    else if (isDoublePointType(point.type))
      thisSegment += `${point.type} ${d(point.xC)} ${d(point.yC)} ${d(
        point.x
      )} ${d(point.y)} `
    // warn if mistake was made
    else console.warn('unknown point type:', i, point)
    //
    // update regular path and the one shown inside #datadiv
    // with selected point highlighted with span
    path += thisSegment
    if (mouse.lastSelectedIndex !== null && i === mouse.lastSelectedIndex) {
      state.highlightedPath += '<span>' + thisSegment + '</span>'
    } else {
      state.highlightedPath += thisSegment
    }
  }
  return path
}

// puts new style tag into header with css
const updateHeader = (cssString, forWho = 'for_html') => {
  // remove old style
  if (window[forWho]) window[forWho].outerHTML = ''

  // attach new style to header
  const styleEl = document.createElement('style')
  styleEl.type = 'text/css'
  styleEl.id = forWho
  styleEl.appendChild(document.createTextNode(cssString))
  document.head.appendChild(styleEl)
}

const copyToClipboard = text => {
  const input = document.createElement('textarea')
  input.innerHTML = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

const pasteFromClipboard = async () => {
  let clipboard = ''
  try {
    clipboard = await navigator.clipboard.readText()
  } catch (e) {
    clipboard = window.prompt('paste image url here')
  }
  return clipboard
}

// undo/redo history
const updateHistory = () => {
  state.history = state.history.slice(0, state.historyIndex + 1)

  // update state if different
  const newState = JSON.stringify(state.path)
  if (newState !== state.history[state.historyIndex])
    state.history.push(newState)

  state.historyIndex = state.history.length - 1
}

/* -------------------------------------------------------------------------- */
/*                               keyboard events                              */
/* -------------------------------------------------------------------------- */

const handleKeyDown = e => {
  /* ---------------------------------- undo ---------------------------------- */

  if (e.key.toLowerCase() === 'z') {
    if (state.historyIndex > 0) {
      state.historyIndex--
      state.path = JSON.parse(state.history[state.historyIndex])
      // reset visuals
      state.activePoint = null
      mouse.lastSelectedIndex = null
      mouse.highlightIndex = null
      // if not done editing, set active & select to that
      const lastPoint = state.path[state.path.length - 1]
      if (lastPoint && lastPoint.type !== 'Z') {
        state.activePoint = state.path.length - 1
        mouse.lastSelectedIndex = state.path.length - 1
      } else {
        state.activePoint = null
        mouse.lastSelectedIndex = null
      }
      alertUser(
        `undo activated ${state.historyIndex} / ${state.history.length - 1}`
      )
    } else {
      state.path = []
      state.activePoint = null
      mouse.lastSelectedIndex = null
      alertUser(`cleared ${state.historyIndex} / ${state.history.length - 1}`)
    }
  }

  /* ---------------------------------- redo ---------------------------------- */

  if (e.key.toLowerCase() === 'y') {
    if (state.historyIndex <= state.history.length - 2) {
      state.historyIndex++
      state.path = JSON.parse(state.history[state.historyIndex])
      // reset visuals
      state.activePoint = null
      mouse.lastSelectedIndex = null
      mouse.highlightIndex = null
      // if not done editing, set active & select to that
      const lastPoint = state.path[state.path.length - 1]
      if (lastPoint && lastPoint.type !== 'Z') {
        state.activePoint = state.path.length - 1
        mouse.lastSelectedIndex = state.path.length - 1
      }
      alertUser(
        `redo activated ${state.historyIndex} / ${state.history.length - 1}`
      )
    }
  }

  /* -------------------------- delete selected point ------------------------- */

  if (e.key.toLowerCase() === 'd') {
    if (
      mouse.lastSelectedIndex !== null && // point must be selected
      state.activePoint === null // not in drawing mode
    ) {
      const pointBefore = state.path[mouse.lastSelectedIndex - 1]
      const twoPointsAfter = state.path[mouse.lastSelectedIndex + 2]
      const twoPointsBefore = state.path[mouse.lastSelectedIndex - 2]
      const pointAfter = state.path[mouse.lastSelectedIndex + 1]
      let preceedingIndexM = mouse.lastSelectedIndex
      while (state.path[--preceedingIndexM].type !== 'M');
      const preceedingM = state.path[preceedingIndexM]

      if (
        pointAfter.type === 'Z' &&
        isSelectableType(pointBefore.type) &&
        twoPointsBefore.type !== 'M'
      ) {
        pointBefore.x = preceedingM.x
        pointBefore.y = preceedingM.y
        pointBefore.xC = preceedingM.x
        pointBefore.yC = preceedingM.y
        state.path.splice(mouse.lastSelectedIndex, 1)
        console.log('deleted 1 point & updated new final point -  done')
      } else if (pointBefore.type === 'M' && pointAfter.type === 'Z') {
        state.path.splice(mouse.lastSelectedIndex - 1, 3)
        console.log('deleted regular, M, and Z points dot - done')
      } else if (
        twoPointsAfter &&
        pointBefore.type === 'M' &&
        twoPointsAfter.type === 'Z'
      ) {
        state.path.splice(mouse.lastSelectedIndex - 1, 4)
        console.log('deleted regular, M, and Z points line - done')
      } else if (
        twoPointsBefore &&
        twoPointsBefore.type === 'M' &&
        pointAfter.type === 'Z'
      ) {
        state.path.splice(mouse.lastSelectedIndex - 2, 4)
        console.log('deleted 2xC, M, and Z points not to leave a dot - done')
      } else {
        state.path.splice(mouse.lastSelectedIndex, 1)
        console.log('deleted 1 point - done')
      }
      mouse.lastSelectedIndex = null
      mouse.nearby = []
      updateHistory()
      alertUser('point(s) deleted')
    }
  }

  /* -------------------------------- add point ------------------------------- */
  if (e.key.toLowerCase() === 'a') {
    if (
      mouse.lastSelectedIndex !== null && // point must be selected
      state.activePoint === null // not in drawing mode
    ) {
      const selectedPoint = state.path[mouse.lastSelectedIndex]
      const copyPoint = JSON.parse(JSON.stringify(selectedPoint))
      if (isDoublePointType(copyPoint.type)) {
        copyPoint.xC = copyPoint.x
        copyPoint.yC = copyPoint.y
        copyPoint.isCurved = false
      }
      state.path.splice(mouse.lastSelectedIndex, 0, copyPoint)
      mouse.lastSelectedIndex++
      console.log('added a new point')
      updateHistory()
      alertUser('added a new point')
    }
  }

  /* ------------------------- copy path to clipboard ------------------------- */
  if (e.key.toLowerCase() === 'c') {
    copyToClipboard(window.svgPath.getAttribute('d').trim())
    alertUser('path copied to clipboard')
  }

  /* --------------------- paste image url from clipboard --------------------- */

  if (e.key.toLowerCase() === 'v') {
    if (!state.backgroundImage)
      (async () => {
        loadBackgroundImage(await pasteFromClipboard())
      })()
    else {
      loadBackgroundImage('')
    }
  }
  /* -------------------------------- toggle snap ------------------------------- */
  if (e.key.toLowerCase() === 'g') {
    state.gridSnapOn = !state.gridSnapOn
    checkGridSnap()
    console.log('toggled snap to', state.gridSnapOn)
    alertUser('toggled snap to ' + state.gridSnapOn)
  }

  /* -------------------------------- clear all ------------------------------- */
  if (e.key.toLowerCase() === 'q') {
    // reset mouse and state
    mouse = JSON.parse(JSON.stringify(mouseInitialize))
    // state = JSON.parse(JSON.stringify(stateInitialize))
    state.path = []
    state.activePoint = null
    updateHistory()
    console.log('entire path removed')
    alertUser('entire path removed')
  }

  /* ------------------------------ resize shape ----------------------------- */
  if (e.key.toLowerCase() === 'w') {
    // reset mouse and state
    if (state.path.length > 3) {
      resizeToFit()
      updateHistory()
      console.log('path resized')
      alertUser('path resized')
    }
  }

  /* ----------------------------- decimal places ---------------------------- */
  if (e.key === '+' && state.decimals < 5) {
    state.decimals++
    alertUser(`Path now using ${state.decimals} decimal places`)
  }
  if (e.key === '-' && state.decimals > 0) {
    state.decimals--
    alertUser(`Path now using ${state.decimals} decimal places`)
  }

  /* --------------------------- toggle path markers -------------------------- */
  if (e.key.toLowerCase() === 'm') {
    state.showAllPointMarkers = !state.showAllPointMarkers
    setJsBasedStyles()
    alertUser(
      state.showAllPointMarkers
        ? 'showing all path markers'
        : 'hiding all path markers'
    )
  }

  /* ---------------------------- cycle point type ---------------------------- */
  if (e.key.toLowerCase() === 't') {
    const selected = state.path[mouse.lastSelectedIndex]
    const isDrawing =
      state.activePoint !== null
        ? state.path.length - 1 === state.activePoint
        : false
    const types = ['L', 'Q', 'S', 'T']
    const describe = {
      L: 'L: Line point set',
      Q: 'Q: Quadratic bezier curve point set',
      S: 'S: Smooth curve point set',
      T: 'T: Smooth quadratic bezier curve point set'
    }

    if (!isDrawing && selected) {
      selected.type = types[(types.indexOf(selected.type) + 1) % types.length]
      alertUser('type ' + describe[selected.type])
      // Q,S
      if (isDoublePointType(selected.type)) {
        selected.xC = selected.xC || selected.x
        selected.yC = selected.yC || selected.y
        selected.isCurved = selected.isCurved || false
        updateHistory()
        return undefined
      }
      // T, L
      if (isSinglePointType(selected.type)) {
        selected.xC = undefined
        selected.yC = undefined
        selected.isCurved = undefined
        updateHistory()
        return undefined
      }
    }

    if (!selected || isDrawing) {
      state.drawPointType =
        types[(types.indexOf(state.drawPointType) + 1) % types.length]
      alertUser('Drawing ' + describe[state.drawPointType])
    }
  }
}

// helpers for safe point types
const isSelectableType = v => ['Q', 'T', 'S', 'L', 'C'].indexOf(v) > -1
const isSinglePointType = v => ['M', 'T', 'L'].indexOf(v) > -1
const isDoublePointType = v => ['Q', 'S'].indexOf(v) > -1
// const isTripplePointType = v => v === 'C'

// load grid style
const checkGridSnap = () => {
  if (state.gridSnapOn) {
    window.transformedPattern.setAttribute('width', state.gridSnapSize)
    window.transformedPattern.setAttribute('height', state.gridSnapSize)
  } else {
    window.transformedPattern.setAttribute('width', 0)
    window.transformedPattern.setAttribute('height', 0)
  }
}

// try to load image for background from url
const loadBackgroundImage = (url, quiet = false) => {
  console.log('attempting to load', url)
  if (url) {
    if (
      url.endsWith('.jpg') ||
      url.endsWith('.png') ||
      url.endsWith('.gif') ||
      url.endsWith('.jpeg')
    ) {
      state.backgroundImage = url
      updateHeader(
        `
        #backgroundImage {
          background: url("${state.backgroundImage}") no-repeat center center fixed;
          -webkit-background-size: cover;
          -moz-background-size: cover;
          -o-background-size: cover;
          background-size: cover;
        }
      `,
        'for_backgroundImage'
      )
      if (!quiet) alertUser('image url loaded')
    } else {
      state.backgroundImage = ''
      updateHeader(``, 'for_backgroundImage')
      if (!quiet) alertUser('image url was not jpeg/jpg/png/gif')
    }
  } else {
    state.backgroundImage = ''
    updateHeader(``, 'for_backgroundImage')
    if (!quiet) alertUser('background image cleared')
  }
}

let alertTimer1 = null,
  alertTimer2 = null

const alertUser = text => {
  window.alertUser.innerHTML = text
  window.alertUser.style.visibility = 'visible'
  window.alertUser.style.opacity = '0.999'
  if (alertTimer1) {
    clearTimeout(alertTimer1)
    clearTimeout(alertTimer2)
  }
  alertTimer1 = setTimeout(() => {
    window.alertUser.style.visibility = 'visible'
    window.alertUser.style.opacity = '0'
  }, 3000)
  alertTimer2 = setTimeout(() => {
    window.alertUser.style.visibility = 'hidden'
    window.alertUser.style.opacity = '0'
  }, 5000)
}

// few constants I need
const [LEFT_MOUSE_BUTTON, RIGHT_MOUSE_BUTTON] = [0, 2]

// take all points and resize them around center by x(1+deltaScale) in or out
// the point at center (e.g. mouse coordiantes) does not move from their location
const zoomShape = ({ centerX, centerY, deltaScale }) => {
  let point,
    multiplier = 1 + deltaScale,
    len = state.path.length
  for (let i = 0; i < len; i++) {
    point = state.path[i]
    // skip non-positioned types
    if (point.type === 'Z') continue
    // types that have x/y
    if (point.x !== undefined && point.x !== null) {
      point.x = (point.x - centerX) * multiplier + centerX
      point.y = (point.y - centerY) * multiplier + centerY
    }
    // types that have 2nd set of coods: xC yC
    if (point.xC !== undefined && point.xC !== null) {
      point.xC = (point.xC - centerX) * multiplier + centerX
      point.yC = (point.yC - centerY) * multiplier + centerY
    }
  }
}

// move shape from reference starting positoins by specific deltas
let referencePositions = []
const panShape = ({ deltaX, deltaY, stop = false }) => {
  // abort movement
  if (stop) {
    referencePositions = []
    return undefined
  }

  if (!referencePositions.length) {
    // if no referencePositions yet, create
    referencePositions = JSON.parse(JSON.stringify(state.path))
  } else {
    // if have reference positions, shift all by deltas
    let len = state.path.length,
      refPoint,
      point
    for (let i = 0; i < len; i++) {
      refPoint = referencePositions[i]
      point = state.path[i]
      // skip non-positioned types
      if (point.type === 'Z') continue
      // types that have x/y
      if (point.x !== undefined) {
        point.x = refPoint.x + deltaX
        point.y = refPoint.y + deltaY
      }
      // types that have xC/yC
      if (point.xC !== undefined) {
        point.xC = refPoint.xC + deltaX
        point.yC = refPoint.yC + deltaY
      }
    }
  }
}

// autofit entire shape
const resizeToFit = (fractionToFill = 0.9) => {
  if (!state.path.length || state.path.length <= 1) return undefined
  // resize to visible size
  let rightmostPoint = 0
  let leftmostPoint = Infinity
  let bottommostPoint = 0
  let topmostPoint = Infinity

  let maxWidthPx = window.innerWidth * fractionToFill
  let maxHeightPx = window.innerHeight * fractionToFill

  for (let i = 0; i < state.path.length; i++) {
    if (state.path[i].type === 'Z') continue
    if (state.path[i].x > rightmostPoint) rightmostPoint = state.path[i].x
    if (state.path[i].x < leftmostPoint) leftmostPoint = state.path[i].x
    if (state.path[i].y < topmostPoint) topmostPoint = state.path[i].y
    if (state.path[i].y > bottommostPoint) bottommostPoint = state.path[i].y
  }
  let shapemaxWidthPx = rightmostPoint - leftmostPoint
  let shapemaxHeightPx = bottommostPoint - topmostPoint

  if (!shapemaxWidthPx || shapemaxWidthPx < 1) return undefined
  if (!shapemaxHeightPx || shapemaxHeightPx < 1) return undefined

  const conversionFactorWidth = maxWidthPx / shapemaxWidthPx
  const conversionFactorHeight = maxHeightPx / shapemaxHeightPx
  const conversionFactor = Math.min(
    conversionFactorWidth,
    conversionFactorHeight
  )
  const leftMargin = (window.innerWidth * (1 - fractionToFill)) / 2
  const topMargin = (window.innerHeight * (1 - fractionToFill)) / 2

  for (let i = 0; i < state.path.length; i++) {
    const point = state.path[i]
    if (point.x)
      state.path[i].x =
        ((point.x - leftmostPoint) * conversionFactor + leftMargin) << 0
    if (point.y)
      state.path[i].y =
        ((point.y - topmostPoint) * conversionFactor + topMargin) << 0
    if (point.xC)
      state.path[i].xC =
        ((point.xC - leftmostPoint) * conversionFactor + leftMargin) << 0
    if (point.yC)
      state.path[i].yC =
        ((point.yC - topmostPoint) * conversionFactor + topMargin) << 0
  }
  updateHistory()
}

// initial placeholder conversion
const loadInitialPlaceholder = () => {
  const pathToUse = state.placeholderPath

  const pathSourceArray = pathToUse.split(/[\s,]{1}/)

  for (let i = 0; i < pathSourceArray.length; i++) {
    const part = pathSourceArray[i]
    // treat L as Q to make it easier to edit
    if (part === 'L') {
      state.path.push({
        type: 'Q',
        xC: +pathSourceArray[i + 1],
        yC: +pathSourceArray[i + 2],
        x: +pathSourceArray[i + 1],
        y: +pathSourceArray[i + 2],
        isCurved: false
      })
      i += 2
    }
    // rest of single coods
    if (part === 'M' || part === 'T') {
      state.path.push({
        type: part,
        x: +pathSourceArray[i + 1],
        y: +pathSourceArray[i + 2]
      })
      i += 2
    }
    // double coods
    if (part === 'Q' || part === 'S') {
      state.path.push({
        type: part,
        xC: +pathSourceArray[i + 1],
        yC: +pathSourceArray[i + 2],
        x: +pathSourceArray[i + 3],
        y: +pathSourceArray[i + 4],
        isCurved: true
      })
      i += 4
    }
    if (part === 'Z') {
      state.path.push({ type: 'Z' })
    }
  }
  mouse.lastSelectedIndex = 30
  resizeToFit()
}

window.onload = () => {
  initialize()
}
