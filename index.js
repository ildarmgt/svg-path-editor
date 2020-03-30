const settingsInitialize = {
  path: [],
  activePoint: null,
  framesPerSecond: 24,
  strokeWidth: 3,
  selectDistance: 10,
  ptEditMode: false,
  placeholder: `M 188 65 L 155 261 L 208 262 L 224 175 L 276 172 L 256 261 L 313 259 L 376 38 L 309 49 L 283 141 L 230 144 L 246 56 Z M 406 120 L 351 258 L 429 257 L 440 119 Z M 412 103 L 421 76 L 449 77 L 447 100 Z M 439 138 L 495 111 Z M 505 75 L 494 112 Z M 496 64 L 504 76 Z M 511 60 L 505 76 Z M 524 67 L 506 76 L 506 76`
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

let mouse, settings

const initialize = () => {
  // reset mouse and settings
  mouse = JSON.parse(JSON.stringify(mouseInitialize))
  settings = JSON.parse(JSON.stringify(settingsInitialize))

  // listen to events
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
  // window.addEventListener("resize", handleResize);

  // set to fill paths and show strokes
  styleToFillShapes(true)

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
  await new Promise(r => setTimeout(r, 1000 / settings.framesPerSecond))

  // keep printing path text on top of svg
  window.datadiv.innerHTML = window.svgPath.getAttribute('d')
  window.datadiv.innerHTML +=
    '\n' +
    JSON.stringify({
      highlightIndex: mouse.highlightIndex,
      activePoint: settings.activePoint,
      lastSelectedIndex: mouse.lastSelectedIndex,
      nearbyNode: settings.path[mouse.highlightIndex],
      activeNode: settings.path[settings.activePoint],
      lastSelectedNode: settings.path[mouse.lastSelectedIndex],
      obj: settings.path
    })

  // loop forever
  window.requestAnimationFrame(() => renderLoop())
}

/* -------------------------------------------------------------------------- */
/*                                 mouse down                                 */
/* -------------------------------------------------------------------------- */

const handleMouseDown = e => {
  const { button } = e
  if (button === LEFT_MOUSE_BUTTON) {
    mouse.left.down = true
    mouse.left.from.x = e.x
    mouse.left.from.y = e.y
  }
  if (button === RIGHT_MOUSE_BUTTON) {
    mouse.right.down = true
    mouse.left.from.x = e.x
    mouse.left.from.y = e.y
  }
  handleMouseMove(e)

  console.log({
    activePoint: settings.activePoint,
    selectedPoint: settings.path[settings.activePoint],
    allPts: settings.path,
    attribute: window.svgPath.getAttribute('d')
  })

  /* ----------------- cancel drawing point via right click ----------------- */

  if (mouse.right.down) {
    let len = settings.path.length
    console.log('MOUSE DOWN: cancel drawing point via right click')
    // change current point to Z if it's the very last point
    if (settings.activePoint === len - 1)
      settings.path[settings.activePoint] = { type: 'Z' }

    // if Z is right after M, it is not even a line so erase both
    if (
      settings.path[len - 1].type === 'Z' &&
      settings.path[len - 2].type === 'M'
    ) {
      settings.path.pop()
      settings.path.pop()
    }
    // unselect active point and individual selections
    settings.activePoint = null
    mouse.lastSelectedIndex = null
    return undefined
  }

  /* ------------------- start or continue creating point ------------------- */
  if (
    mouse.left.down && // lmb used
    !mouse.right.down && // rmb not used
    mouse.nearby.length === 0 // no nearby points
  ) {
    console.log('MOUSE DOWN: start or continue creating point')
    // if no active point, move mouse there and move to new starting point
    if (settings.activePoint === null) {
      settings.path.push({ type: 'M', x: mouse.x, y: mouse.y })
    }
    // either way makes line to next point AND becomes the active point
    settings.path.push({ type: 'L', x: mouse.x, y: mouse.y })
    settings.activePoint = settings.path.length - 1
    mouse.lastSelectedIndex = null
    return undefined
  }

  /* ----------------------- actively move selected index -------------------- */

  if (
    mouse.left.down && // left button is down
    mouse.nearby.length >= 1 && // at least 1 node nearby
    mouse.nearby.indexOf(mouse.lastSelectedIndex) > -1 && // selected node is one of nearby's
    settings.activePoint === null // no actively moving node
  ) {
    console.log('MOUSE DOWN: actively move selected index')
    settings.activePoint = mouse.lastSelectedIndex // actively moving node index
    return undefined
  }
}

/* -------------------------------------------------------------------------- */
/*                                  mouse up                                  */
/* -------------------------------------------------------------------------- */

const handleMouseUp = e => {
  const { button } = e
  if (button === LEFT_MOUSE_BUTTON) mouse.left.down = false
  if (button === RIGHT_MOUSE_BUTTON) mouse.right.down = false
  handleMouseMove(e)

  /* -------------------------- select existing point ------------------------- */
  // allows selection of an existing point but need extra click to move it
  if (
    button === LEFT_MOUSE_BUTTON && // left button was just brought up
    mouse.nearby.length >= 1 && // at least 1 node nearby
    settings.activePoint === null // no actively moving node
  ) {
    console.log('MOUSE UP: select existing point')
    // pick random of nearby points each click
    let rndNearbyIndex = Math.floor(Math.random() * mouse.nearby.length)
    let rndNearbyPathPointIndex = mouse.nearby[rndNearbyIndex]
    // settings.activePoint = rndNearbyPathPointIndex
    mouse.lastSelectedIndex = rndNearbyPathPointIndex
    // no shape fill while selecting
    return undefined
  }

  /* --------------------------- cancel moving point on left click -------------------------- */
  if (
    button === LEFT_MOUSE_BUTTON &&
    settings.activePoint !== null &&
    mouse.lastSelectedIndex !== null
  ) {
    console.log('MOUSE UP: cancel moving point on left click')
    // remove it from active index and take off edit mode & filled render ok
    settings.activePoint = null // remove from active but keep it in lastSelected as last selection
    return undefined
  }
}

/* -------------------------------------------------------------------------- */
/*                                mouse moving                                */
/* -------------------------------------------------------------------------- */

const handleMouseMove = e => {
  updateMousePosition(e)
  let active = settings.path[settings.activePoint]
  // if there's an active point keep updating it based on mouse pos

  if (settings.activePoint !== null) {
    settings.path[settings.activePoint] = {
      type: active.type || 'L',
      x: mouse.x,
      y: mouse.y
    }
  }

  // keep track of nearby points to select
  if (settings.activePoint === null) checkNearbyVertex()
}

// puts indecies of nearby points into an array mouse.nearby[]
const checkNearbyVertex = () => {
  let nearby = [],
    toMouseDistanceSq,
    cutoffSq = settings.selectDistance ** 2,
    point,
    closestSq = Infinity,
    closestIndex = 0

  for (let i = 0; i < settings.path.length; i++) {
    point = settings.path[i]
    // for types M L with coordinates
    // check proximity to mouse
    if (point.type !== 'Z') {
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

const updateMousePosition = e => {
  mouse.x = e.x
  mouse.y = e.y
}

// moving close - highlights nodes
// clicking - selects nodes
// dragging after that makes them active moving nodes
// to drag just need to check click can be for selected element

const updateHighlightedPoint = () => {
  let circle = window.highlightCircle

  if (mouse.highlightIndex !== null && settings.path[mouse.highlightIndex]) {
    circle.setAttribute('cx', settings.path[mouse.highlightIndex].x)
    circle.setAttribute('cy', settings.path[mouse.highlightIndex].y)
    circle.setAttribute('r', '10')
  } else {
    circle.setAttribute('r', '0')
  }
}

const updateSelectedPoint = () => {
  let circle = window.selectionCircle

  if (
    mouse.lastSelectedIndex !== null &&
    settings.path[mouse.lastSelectedIndex]
  ) {
    circle.setAttribute('cx', settings.path[mouse.lastSelectedIndex].x)
    circle.setAttribute('cy', settings.path[mouse.lastSelectedIndex].y)
    circle.setAttribute('r', '10')
  } else {
    circle.setAttribute('r', '0')
  }
}

// set style of paths to fill or not
const styleToFillShapes = doIt => {
  if (doIt)
    updateHeader(
      `path { fill: var(--fillColor); stroke-width: ${settings.strokeWidth};}`,
      'for_path'
    )
  else
    updateHeader(
      `path { fill: none; stroke-width: ${settings.strokeWidth};}`,
      'for_path'
    )
}

const makePath = () => {
  if (!settings.path.length) return settings.placeholder
  let path = ''
  for (let i = 0; i < settings.path.length; i++) {
    const point = settings.path[i]
    // close shape point
    if (point.type === 'Z') path += `${point.type} `
    // types M L so on with 2 coods
    else path += `${point.type} ${point.x} ${point.y} `
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

// few constants I need
const [LEFT_MOUSE_BUTTON, RIGHT_MOUSE_BUTTON] = [0, 2]

initialize()

// const html = document.getElementsByTagName("html")[0];
// html.style.setProperty("--myPath", 'path("' + settings.path + 'Z")');
