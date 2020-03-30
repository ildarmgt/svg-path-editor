const stateInitialize = {
  path: [],
  history: [],
  historyIndex: 0,
  activePoint: null,
  framesPerSecond: 24,
  strokeWidth: 3,
  gridSnapSize: 10,
  gridSnapOn: false,
  selectDistance: 10,
  backgroundImage:
    'https://cdn.pixabay.com/photo/2018/07/14/07/58/cat-3537115_960_720.jpg',
  placeholderPath: `M 162 71 L 92 555 L 176 544 L 218 342 L 288 347 L 239 563 L 340 544 L 425 68 L 332 91 L 301 285 L 215 276 L 268 60 L 162 71 Z M 438 536 L 496 310 L 556 299 L 539 550 L 438 536 Z M 502 232 Q 514 204 543 199 Q 585 199 572 234 Q 562 265 528 267 Q 497 267 502 232 Z M 711 101 L 711 562 Q 830 435 861 381 Q 931 553 990 572 Q 988 293 1090 122 L 1039 79 Q 932 356 947 411 L 877 278 Q 785 411 759 407 L 782 65 L 711 101 Z M 1073 472 Q 1083 363 1152 364 Q 1250 363 1221 459 Q 1200 546 1140 554 Q 1061 566 1073 472 Z M 1131 509 Q 1169 514 1184 465 Q 1204 407 1156 404 Q 1123 407 1110 448 Q 1095 505 1131 509 Z M 1252 548 L 1280 358 L 1324 358 L 1316 398 Q 1381 358 1432 389 L 1417 433 Q 1359 399 1311 445 L 1311 445 L 1289 546 L 1252 548 Z M 1497 99 L 1450 553 L 1510 546 Q 1542 188 1544 144 Q 1515 125 1497 99 Z M 1599 426 Q 1554 467 1575 499 Q 1604 559 1736 535 L 1748 117 L 1700 136 L 1698 398 Q 1645 395 1599 426 Z M 1624 453 Q 1706 407 1704 479 Q 1705 526 1635 504 Q 1587 478 1624 453 Z`,
  highlightedPath: ''
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

const initialize = () => {
  // reset mouse and state
  mouse = JSON.parse(JSON.stringify(mouseInitialize))
  state = JSON.parse(JSON.stringify(stateInitialize))

  // listen to events
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('keydown', handleKeyDown)

  // set to fill paths and show strokes
  styleToFillShapes(true)

  updateHistory()

  initialImage()
  loadBackgroundImage(state.backgroundImage)

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
  window.datadiv.innerHTML += '    left click \t\t- to start drawing\n'
  window.datadiv.innerHTML += '    left drag \t\t- to curve while drawing\n'
  window.datadiv.innerHTML +=
    '    right click \t\t- to cancel selection or complete shape \n'
  window.datadiv.innerHTML += '    left click points \t- to edit points\n'
  window.datadiv.innerHTML +=
    '    direction \t\t- opposite directions to create openings\n'
  window.datadiv.innerHTML +=
    '    curve or line \t- move red control dot to edit curve or move onto green to make into a line\n\n'
  window.datadiv.innerHTML += '    "c" to copy svg path to clipboard\n'
  window.datadiv.innerHTML += `    "v" to clear/load image url from clipboard (jpg/png) (now: ${state.backgroundImage ||
    'none'})\n`
  window.datadiv.innerHTML += '    "z" to undo\n'
  window.datadiv.innerHTML += '    "y" to redo\n'
  window.datadiv.innerHTML += `    "q" to clear everything\n`
  window.datadiv.innerHTML += `    "g" to turn grid snap on (now ${state.gridSnapOn})\n`

  window.datadiv.innerHTML += '    "d" to delete selected point\n'
  window.datadiv.innerHTML += '    "a" to add new point on top of selected\n'
  window.datadiv.innerHTML += '    "w" to resize path to fit viewscreen\n'

  window.datadiv.innerHTML += '\n\n' + state.highlightedPath // window.svgPath.getAttribute('d')

  // window.focus() // keep getting focus for keyboard events

  // loop forever
  window.requestAnimationFrame(() => renderLoop())
}

/* -------------------------------------------------------------------------- */
/*                                 mouse down                                 */
/* -------------------------------------------------------------------------- */

const handleMouseDown = e => {
  // const { button } = e
  handleMouseMove(e, { down: true })

  /* ----------------- cancel drawing point via right click ----------------- */

  if (mouse.right.down) {
    let len = state.path.length
    console.log('MOUSE DOWN: cancel drawing point via right click')

    // change current point to Q & Z if it's the very last point
    if (state.activePoint === len - 1) {
      // find last M
      let previousM = state.activePoint
      while ((previousM--, state.path[previousM].type !== 'M'));

      state.path[state.activePoint] = {
        type: 'Q',
        x: state.path[previousM].x,
        y: state.path[previousM].y,
        xQ: state.path[previousM].x,
        yQ: state.path[previousM].y,
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
    ? (mouse.x - selectedPoint.xQ) ** 2 + (mouse.y - selectedPoint.yQ) ** 2 <
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
      type: 'Q',
      x: mouse.x,
      y: mouse.y,
      xQ: null,
      yQ: null,
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

  // if moving last point before Z, move M before Z as well
  // because last point connects to M on cancel
  if (active && isNextZ && previousM) {
    previousM.x = mouse.x
    previousM.y = mouse.y
  }

  // move active simple x/y points to mouse location
  if (active && active.type === 'L') {
    // active.type = active.type
    active.x = mouse.x
    active.y = mouse.y
  }

  if (active && active.type === 'Q') {
    const isDrawing = state.path.length - 1 === state.activePoint

    // mouse dragged far enough?
    // const wasDraggedFarEnough =
    //   (mouse.x - mouse.left.from.x) ** 2 + (mouse.y - mouse.left.from.y) ** 2 >
    //   state.selectDistance ** 2

    // move active end-point to mouse location
    // if (wasDraggedFarEnough) {
    active.x = mouse.x
    active.y = mouse.y
    // }

    // if just created, set control point to current location
    if (active.xQ === null) {
      active.xQ = mouse.x
      active.yQ = mouse.y
    }

    // if is not curved move control point to specific point
    if (isDrawing && !mouse.left.down && !active.isCurved) {
      active.xQ = mouse.x
      active.yQ = mouse.y
    }

    // if drawing && not just created and lmb is down, curve it by setting control point to lmb's from
    if (isDrawing && mouse.left.down) {
      // to avoid mistakes, make sure it was dragged far enough during drawing
      const wasDraggedFarEnough =
        (mouse.x - mouse.left.from.x) ** 2 +
          (mouse.y - mouse.left.from.y) ** 2 >
        state.selectDistance ** 2
      if (wasDraggedFarEnough) {
        active.xQ = mouse.left.from.x
        active.yQ = mouse.left.from.y
        active.isCurved = true
      }
    }

    // if dragging in edit mode, mark as curved
    if (!isDrawing && mouse.left.down) {
      active.isCurved = true
    }
  }

  /* ------------- for selected but not actively moving points ------------- */

  // if this is moving selected control point instead of selected point
  if (
    !up &&
    !down &&
    !active &&
    selected &&
    mouse.left.down &&
    selected.type === 'Q'
  ) {
    // loose proximity to control point
    const isControlPointNearMouse =
      (mouse.x - selected.xQ) ** 2 + (mouse.y - selected.yQ) ** 2 <
      100 * state.selectDistance ** 2
    // mouse closer to end point than control
    const isMouseCloserToEndPoint =
      (mouse.x - selected.xQ) ** 2 + (mouse.y - selected.yQ) ** 2 >
      (mouse.x - selected.x) ** 2 + (mouse.y - selected.y) ** 2
    // is control point near endpoint
    const isControlPointNearEndPoint =
      (selected.x - selected.xQ) ** 2 + (selected.y - selected.yQ) ** 2 <
      state.selectDistance ** 2

    // make control point curve by following mouse
    if (
      isControlPointNearMouse &&
      !isControlPointNearEndPoint &&
      !isMouseCloserToEndPoint
    ) {
      selected.xQ = mouse.x
      selected.yQ = mouse.y
      selected.isCurved = true
    }
    // make control point snap to endpoint
    if (isControlPointNearMouse && isControlPointNearEndPoint) {
      selected.xQ = selected.x
      selected.yQ = selected.y
      selected.isCurved = false
    }
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
    mouse.left.from.x = mouse.x
    mouse.left.from.y = mouse.y
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
    circle.setAttribute('r', '10')
  } else {
    circle.setAttribute('r', '0')
  }
}

// place selected circle to visualize selected point
const updateSelectedPoint = () => {
  const circle = window.selectionCircle
  const controlCircle = window.controlCircle
  const controlPath = window.controlPath
  const selectedPoint = state.path[mouse.lastSelectedIndex]

  // actual point selected
  if (mouse.lastSelectedIndex !== null && selectedPoint) {
    circle.setAttribute('cx', selectedPoint.x)
    circle.setAttribute('cy', selectedPoint.y)
    circle.setAttribute('r', '10')
  } else {
    circle.setAttribute('r', '0')
  }

  // the control point and lines for Q point
  if (
    mouse.lastSelectedIndex !== null &&
    selectedPoint &&
    selectedPoint.type === 'Q'
  ) {
    // control point (invisible mid-point)
    controlCircle.setAttribute('cx', selectedPoint.xQ)
    controlCircle.setAttribute('cy', selectedPoint.yQ)
    controlCircle.setAttribute('r', '10')
    // path to point before and after
    const beforeSelectedPoint = state.path[mouse.lastSelectedIndex - 1]
    let controlPathValue = ''
    if (beforeSelectedPoint)
      controlPathValue += `M ${beforeSelectedPoint.x} ${beforeSelectedPoint.y} L ${selectedPoint.xQ} ${selectedPoint.yQ} `
    controlPathValue += `M ${selectedPoint.x} ${selectedPoint.y} L ${selectedPoint.xQ} ${selectedPoint.yQ} `
    controlPath.setAttribute('d', controlPathValue)
  } else {
    // hide control circle and path
    controlCircle.setAttribute('r', '0')
    controlPath.setAttribute('d', '')
  }
}

// set style of paths to fill or not
const styleToFillShapes = doIt => {
  if (doIt)
    updateHeader(
      `path { fill: var(--fillColor); stroke-width: ${state.strokeWidth};}`,
      'for_path'
    )
  else
    updateHeader(
      `path { fill: none; stroke-width: ${state.strokeWidth};}`,
      'for_path'
    )
}

/* -------------------------------------------------------------------------- */
/*                          creates path from points                          */
/* -------------------------------------------------------------------------- */

const makePath = () => {
  let path = ''
  state.highlightedPath = ''

  for (let i = 0; i < state.path.length; i++) {
    const point = state.path[i]
    let thisSegment = ''
    // close shape point
    if (point.type === 'Z') thisSegment += `${point.type} `
    else if (point.type === 'M' || point.type === 'L')
      thisSegment += `${point.type} ${point.x} ${point.y} `
    // types M L so on with 2 coods
    else if (point.type === 'Q' && point.isCurved)
      thisSegment += `${point.type} ${point.xQ} ${point.yQ} ${point.x} ${point.y} `
    // save space by drawing non curved Q as L
    else if (point.type === 'Q' && !point.isCurved)
      thisSegment += `L ${point.x} ${point.y} `
    else console.log('unknown point type:', i, point)
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
      console.log(
        'undo done',
        state.historyIndex,
        'of',
        state.history.length - 1
      )
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
      console.log(
        'redo done',
        state.historyIndex,
        'of',
        state.history.length - 1
      )
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
        pointBefore.type === 'Q' &&
        twoPointsBefore.type !== 'M'
      ) {
        pointBefore.x = preceedingM.x
        pointBefore.y = preceedingM.y
        pointBefore.xQ = preceedingM.x
        pointBefore.yQ = preceedingM.y
        state.path.splice(mouse.lastSelectedIndex, 1)
        console.log('deleted 1 point & updated new final point -  done')
      } else if (pointBefore.type === 'M' && pointAfter.type === 'Z') {
        state.path.splice(mouse.lastSelectedIndex - 1, 3)
        console.log('deleted Q, M, and Z points dot - done')
      } else if (
        twoPointsAfter &&
        pointBefore.type === 'M' &&
        twoPointsAfter.type === 'Z'
      ) {
        state.path.splice(mouse.lastSelectedIndex - 1, 4)
        console.log('deleted Q, M, and Z points line - done')
      } else if (
        twoPointsBefore &&
        twoPointsBefore.type === 'M' &&
        pointAfter.type === 'Z'
      ) {
        state.path.splice(mouse.lastSelectedIndex - 2, 4)
        console.log('deleted 2xQ, M, and Z points not to leave a dot - done')
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
      if (copyPoint.type === 'Q') {
        copyPoint.xQ = copyPoint.x
        copyPoint.yQ = copyPoint.y
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
    if (state.gridSnapOn) {
      window.transformedPattern.setAttribute('width', state.gridSnapSize)
      window.transformedPattern.setAttribute('height', state.gridSnapSize)
    } else {
      window.transformedPattern.setAttribute('width', 0)
      window.transformedPattern.setAttribute('height', 0)
    }
    console.log('toggled snap to', state.gridSnapOn)
    alertUser('toggled snap to ' + state.gridSnapOn)
  }

  /* -------------------------------- clear all ------------------------------- */
  if (e.key.toLowerCase() === 'q') {
    // reset mouse and state
    mouse = JSON.parse(JSON.stringify(mouseInitialize))
    state = JSON.parse(JSON.stringify(stateInitialize))
    console.log('everything reset')
    alertUser('everything reset')
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
}

const loadBackgroundImage = url => {
  console.log(url)
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
      alertUser('image url loaded')
    } else {
      state.backgroundImage = ''
      updateHeader('', 'for_backgroundImage')
      alertUser('image url was not jpeg/jpg/png/gif')
    }
  } else {
    state.backgroundImage = ''
    updateHeader('', 'for_backgroundImage')
    alertUser('background image cleared')
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
    if (point.xQ)
      state.path[i].xQ =
        ((point.xQ - leftmostPoint) * conversionFactor + leftMargin) << 0
    if (point.yQ)
      state.path[i].yQ =
        ((point.yQ - topmostPoint) * conversionFactor + topMargin) << 0
  }
}

// initial placeholder conversion
const initialImage = () => {
  const pathToUse = state.placeholderPath

  const pathSourceArray = pathToUse.split(' ')
  // const pathResultArray = []

  // let currentPt = ''
  for (let i = 0; i < pathSourceArray.length; i++) {
    const part = pathSourceArray[i]
    if (part === 'M') {
      state.path.push({
        type: 'M',
        x: +pathSourceArray[i + 1],
        y: +pathSourceArray[i + 2]
      })
      i += 2
    }
    if (part === 'Q') {
      state.path.push({
        type: 'Q',
        xQ: +pathSourceArray[i + 1],
        yQ: +pathSourceArray[i + 2],
        x: +pathSourceArray[i + 3],
        y: +pathSourceArray[i + 4],
        isCurved: true
      })
      i += 4
    }
    if (part === 'L') {
      state.path.push({
        type: 'Q',
        xQ: +pathSourceArray[i + 1],
        yQ: +pathSourceArray[i + 2],
        x: +pathSourceArray[i + 1],
        y: +pathSourceArray[i + 2],
        isCurved: false
      })
      i += 2
    }
    if (part === 'Z') {
      state.path.push({ type: 'Z' })
    }
  }

  resizeToFit()
  updateHistory()
}

initialize()
