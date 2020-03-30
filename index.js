const stateInitialize = {
  path: [],
  history: [],
  historyIndex: 0,
  activePoint: null,
  framesPerSecond: 24,
  strokeWidth: 3,
  gridSnapSize: 20,
  gridSnapOn: false,
  selectDistance: 20
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
  document.addEventListener('keydown', handleKeyDown)

  // set to fill paths and show strokes
  styleToFillShapes(true)

  updateHistory()

  initialImage()

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
  window.datadiv.innerHTML = '  Path automatically copied to clipboard\n'
  window.datadiv.innerHTML +=
    '    left click to start drawing\n    right click to cancel\n    drag to curve\n'
  window.datadiv.innerHTML +=
    '    to edit points, cancel drawing and click on existing points\n'
  window.datadiv.innerHTML +=
    '    change direction to create openings in shapes\n'
  window.datadiv.innerHTML +=
    '    move red control dot onto green select dot to convert to a line\n'
  window.datadiv.innerHTML += `    q to clear everything\n`
  window.datadiv.innerHTML += `    g to turn grid snap on (now ${state.gridSnapOn})\n`
  window.datadiv.innerHTML += '    z to undo, y to redo\n'
  window.datadiv.innerHTML += '    d to delete selected pointd\n'
  window.datadiv.innerHTML += '    a to add new point on top of selected\n\n'
  window.datadiv.innerHTML += window.svgPath.getAttribute('d')

  // loop forever
  window.requestAnimationFrame(() => renderLoop())
}

/* -------------------------------------------------------------------------- */
/*                                 mouse down                                 */
/* -------------------------------------------------------------------------- */

const handleMouseDown = e => {
  // const { button } = e
  handleMouseMove(e, { down: true })

  console.log('down', {
    activePointIndex: state.activePoint,
    activePoint: state.path[state.activePoint],
    state,
    attribute: window.svgPath.getAttribute('d')
  })

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

  console.log('up', {
    activePointIndex: state.activePoint,
    activePoint: state.path[state.activePoint],
    state,
    attribute: window.svgPath.getAttribute('d')
  })

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
      // active.xQ = (0.5 * mouse.x + 0.5 * previousToActive.x) << 0
      // active.yQ = (0.5 * mouse.y + 0.5 * previousToActive.y) << 0
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

  /* ------------------- copy path to clipboard on mouse up ------------------- */
  if (up) {
    copyToClipboard(window.svgPath.getAttribute('d'))
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
  for (let i = 0; i < state.path.length; i++) {
    const point = state.path[i]
    // close shape point
    if (point.type === 'Z') path += `${point.type} `
    else if (point.type === 'M' || point.type === 'L')
      path += `${point.type} ${point.x} ${point.y} `
    // types M L so on with 2 coods
    else if (point.type === 'Q' && point.isCurved)
      path += `${point.type} ${point.xQ} ${point.yQ} ${point.x} ${point.y} `
    // save space by drawing non curved Q as L
    else if (point.type === 'Q' && !point.isCurved)
      path += `L ${point.x} ${point.y} `
    else console.log('unknown point type:', i, point)
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

// undo/redo history
const updateHistory = () => {
  state.history = state.history.slice(0, state.historyIndex + 1)

  // update state if different
  const newState = JSON.stringify(state.path)
  if (newState !== state.history[state.historyIndex])
    state.history.push(newState)

  state.historyIndex = state.history.length - 1
  // console.log(state.historyIndex, state.history.length)
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
  }

  /* -------------------------------- clear all ------------------------------- */
  if (e.key.toLowerCase() === 'q') {
    // reset mouse and state
    mouse = JSON.parse(JSON.stringify(mouseInitialize))
    state = JSON.parse(JSON.stringify(stateInitialize))
    console.log('everything reset')
  }
}

// few constants I need
const [LEFT_MOUSE_BUTTON, RIGHT_MOUSE_BUTTON] = [0, 2]

// initial words
const initialImage = () => {
  state.path = JSON.parse(
    `[{"type":"M","x":152,"y":64},{"type":"Q","x":105,"y":390,"xQ":105,"yQ":390,"isCurved":false},{"type":"Q","x":161,"y":393,"xQ":161,"yQ":393,"isCurved":false},{"type":"Q","x":190,"y":246,"xQ":190,"yQ":246,"isCurved":false},{"type":"Q","x":237,"y":250,"xQ":237,"yQ":250,"isCurved":false},{"type":"Q","x":206,"y":388,"xQ":206,"yQ":388,"isCurved":false},{"type":"Q","x":277,"y":374,"xQ":277,"yQ":374,"isCurved":false},{"type":"Q","x":329,"y":62,"xQ":329,"yQ":62,"isCurved":false},{"type":"Q","x":266,"y":78,"xQ":266,"yQ":78,"isCurved":false},{"type":"Q","x":246,"y":208,"xQ":246,"yQ":208,"isCurved":false},{"type":"Q","x":188,"y":202,"xQ":188,"yQ":202,"isCurved":false},{"type":"Q","x":224,"y":57,"xQ":224,"yQ":57,"isCurved":false},{"type":"Q","x":152,"y":64,"xQ":152,"yQ":64,"isCurved":false},{"type":"Z"},{"type":"M","x":338,"y":377},{"type":"Q","x":377,"y":225,"xQ":377,"yQ":225,"isCurved":false},{"type":"Q","x":417,"y":218,"xQ":417,"yQ":218,"isCurved":false},{"type":"Q","x":406,"y":386,"xQ":406,"yQ":386,"isCurved":false},{"type":"Q","x":338,"y":377,"xQ":338,"yQ":377,"isCurved":false},{"type":"Z"},{"type":"M","x":381,"y":172},{"type":"Q","x":409,"y":150,"xQ":389,"yQ":154,"isCurved":true},{"type":"Q","x":428,"y":174,"xQ":436,"yQ":150,"isCurved":true},{"type":"Q","x":398,"y":196,"xQ":421,"yQ":194,"isCurved":true},{"type":"Q","x":381,"y":172,"xQ":378,"yQ":196,"isCurved":true},{"type":"Z"},{"type":"M","x":522,"y":85},{"type":"Q","x":522,"y":394,"xQ":522,"yQ":394,"isCurved":false},{"type":"Q","x":622,"y":273,"xQ":601,"yQ":309,"isCurved":true},{"type":"Q","x":709,"y":401,"xQ":669,"yQ":388,"isCurved":true},{"type":"Q","x":776,"y":98,"xQ":708,"yQ":213,"isCurved":true},{"type":"Q","x":742,"y":70,"xQ":742,"yQ":70,"isCurved":false},{"type":"Q","x":680,"y":293,"xQ":670,"yQ":256,"isCurved":true},{"type":"Q","x":633,"y":204,"xQ":633,"yQ":204,"isCurved":false},{"type":"Q","x":554,"y":290,"xQ":572,"yQ":293,"isCurved":true},{"type":"Q","x":569,"y":60,"xQ":569,"yQ":60,"isCurved":false},{"type":"Q","x":522,"y":85,"xQ":522,"yQ":85,"isCurved":false},{"type":"Z"},{"type":"M","x":765,"y":334},{"type":"Q","x":818,"y":261,"xQ":772,"yQ":260,"isCurved":true},{"type":"Q","x":864,"y":325,"xQ":884,"yQ":260,"isCurved":true},{"type":"Q","x":810,"y":389,"xQ":850,"yQ":384,"isCurved":true},{"type":"Q","x":765,"y":334,"xQ":757,"yQ":397,"isCurved":true},{"type":"Z"},{"type":"M","x":804,"y":358},{"type":"Q","x":840,"y":329,"xQ":829,"yQ":362,"isCurved":true},{"type":"Q","x":821,"y":288,"xQ":852,"yQ":290,"isCurved":true},{"type":"Q","x":790,"y":318,"xQ":798,"yQ":290,"isCurved":true},{"type":"Q","x":804,"y":358,"xQ":780,"yQ":356,"isCurved":true},{"type":"Z"},{"type":"M","x":885,"y":385},{"type":"Q","x":904,"y":257,"xQ":904,"yQ":257,"isCurved":false},{"type":"Q","x":933,"y":257,"xQ":933,"yQ":257,"isCurved":false},{"type":"Q","x":928,"y":284,"xQ":928,"yQ":284,"isCurved":false},{"type":"Q","x":1006,"y":278,"xQ":972,"yQ":257,"isCurved":true},{"type":"Q","x":996,"y":308,"xQ":996,"yQ":308,"isCurved":false},{"type":"Q","x":925,"y":316,"xQ":957,"yQ":285,"isCurved":true},{"type":"Q","x":925,"y":316,"xQ":925,"yQ":316,"isCurved":false},{"type":"Q","x":910,"y":384,"xQ":910,"yQ":384,"isCurved":false},{"type":"Q","x":885,"y":385,"xQ":885,"yQ":385,"isCurved":false},{"type":"Z"},{"type":"M","x":1053,"y":121},{"type":"Q","x":1000,"y":388,"xQ":1000,"yQ":388,"isCurved":false},{"type":"Q","x":1045,"y":385,"xQ":1045,"yQ":385,"isCurved":false},{"type":"Q","x":1097,"y":105,"xQ":1097,"yQ":105,"isCurved":false},{"type":"Q","x":1053,"y":121,"xQ":1053,"yQ":121,"isCurved":false},{"type":"Z"},{"type":"M","x":1129,"y":302},{"type":"Q","x":1134,"y":382,"xQ":1068,"yQ":346,"isCurved":true},{"type":"Q","x":1197,"y":353,"xQ":1197,"yQ":386,"isCurved":true},{"type":"Q","x":1253,"y":134,"xQ":1253,"yQ":134,"isCurved":false},{"type":"Q","x":1201,"y":110,"xQ":1201,"yQ":110,"isCurved":false},{"type":"Q","x":1185,"y":284,"xQ":1204,"yQ":184,"isCurved":true},{"type":"Q","x":1129,"y":302,"xQ":1150,"yQ":289,"isCurved":true},{"type":"Z"},{"type":"M","x":1140,"y":325},{"type":"Q","x":1178,"y":330,"xQ":1181,"yQ":301,"isCurved":true},{"type":"Q","x":1137,"y":356,"xQ":1172,"yQ":365,"isCurved":true},{"type":"Q","x":1140,"y":325,"xQ":1121,"yQ":341,"isCurved":true},{"type":"Z"}]`
  )

  // resize to visible size
  let widestPoint = 0
  let maxWidth = window.innerWidth * 0.9
  console.log('uh', { widestPoint })
  for (let i = 0; i < state.path.length; i++) {
    if (state.path[i].x > widestPoint) widestPoint = state.path[i].x
  }
  for (let i = 0; i < state.path.length; i++) {
    const point = state.path[i]
    if (point.x) state.path[i].x = ((point.x / widestPoint) * maxWidth) << 0
    if (point.y) state.path[i].y = ((point.y / widestPoint) * maxWidth) << 0
    if (point.xQ) state.path[i].xQ = ((point.xQ / widestPoint) * maxWidth) << 0
    if (point.yQ) state.path[i].yQ = ((point.yQ / widestPoint) * maxWidth) << 0
  }
  updateHistory()
}

initialize()
