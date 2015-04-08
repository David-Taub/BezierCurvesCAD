$( document ).ready(function()
{
  main( .4, [{"x":0.94,"y":0.55},{"x":0.88,"y":0.02},{"x":0.30,"y":0.23},{"x":0.73,"y":0.71}])
})


function main(scale, points)
{
  var HISTORY_MAX_SIZE = 50
  var history = [], forwardHistory = []
  var currentCurveId = 0
  var timer, deCasteljauRatio = 1
  var curves
  var curveCanvas, curveCtx, width, height, height1, plotWidth, doublePlotWidth,  dragId = -1
  init()
  resize()

  function init()
  {
    var curve = {
      points : points,
      startT : 0,
      endT : 1
    }
    curves = [curve]

    $("#slider").value = $("#slider").max
    curveCanvas = $("#bezierCanvas").get(0)
    curveCtx = curveCanvas.getContext("2d")
    $("#fileInput").change(loadCurves)
    $("#downloadButton").click(saveCurves)
    $("#bezierCanvas").mousemove(drag)
    $("#bezierCanvas").mousedown(startDrag)
    $("#bezierCanvas").mouseup(stopDrag)
    $("#slider").on("change", function()
    {
      clearInterval(timer)
      deCasteljauRatio = this.value/this.max
      drawCurves()
    })

    //Mobile support
    $(document).keyup(onKeyUp)
    $(document).resize(resize)
  }

  function undo()
  {
    //Nothing in history
    if (history.length == 0)
    {
      return
    }
    forwardHistory.push(curves)

    curves = history.pop()
    if (currentCurveId >= curves.length)
    {
      currentCurveId = 0
    }
    updateCurvesList()
    resize()
  }

  function redo()
  {
    if (forwardHistory.length == 0)
    {
      return
    }
    history.push(curves)
    curves = forwardHistory.pop()
    if (currentCurveId >= curves.length)
    {
      currentCurveId = 0
    }
    updateCurvesList()
    resize()
  }


  function pushToHistory()
  {
    //Deep copy
    curvesCopy = []
    for (var i = 0; i < curves.length; i++)
    {
      curveCopy = {
        startT : curves[i].startT,
        endT : curves[i].endT,
        points : []
      }

      for (var j = 0; j < curves[i].points.length; j++)
      {
        curveCopy.points.push($.extend({}, curves[i].points[j]))
      }
      curvesCopy.push(curveCopy)
    }

    history.push(curvesCopy)
    //Keep history size limited
    if (history.length > HISTORY_MAX_SIZE)
    {
      history.shift()
    }
    forwardHistory = []
  }

  //Load curves from file which is selected in "browse..." element
  function loadCurves(ev) {
    var file = $("#fileInput")[0].files[0]; // FileList object
    var reader = new FileReader()

    // Closure to capture the file information.
    reader.onload = function(e)
    {
      pushToHistory()
      curves = JSON.parse(reader.result)
      updateCurvesList()
      resize()
    }

    // Read in the image file as a data URL.
    reader.readAsText(file)
  }


  //download current curves in JSON format
  function saveCurves()
  {
    download("curves.json", JSON.stringify(curves))
  }

  //Download given text as a file with the given filename
  function download(filename, text)
  {
    var pom = document.createElement('a')
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
    pom.setAttribute('download', filename)

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents')
        event.initEvent('click', true, true)
        pom.dispatchEvent(event)
    }
    else {
        pom.click()
    }
  }

  //fire up event handlers after keyboard press event
  function onKeyUp(ev)
  {
    switch(ev.keyCode)
    {
      //DELETE
      case 46:
        deletePoint()
        break
      //C
      case 67:
        drawDeCasteljau()
        break
      case 79:
        mergeCurves(2)
        break
      //Z
      case 90:
        if (ev.ctrlKey)
        {
          undo()
        }
        break
      //Y
      case 89:
        if (ev.ctrlKey)
        {
          redo()
        }
        break
    }
  }

  //Start a timer that draws the moving DeCasteljau skeleton
  function drawDeCasteljau()
  {
    deCasteljauRatio = 0
    clearInterval(timer)
    timer = window.setInterval(stepDeCasteljau, 5)
  }
  //Advance the current deCasteljauRatio and draw the Bezier curve with
  //the DeCasteljau skeleton.
  function stepDeCasteljau()
  {
    deCasteljauRatio += 0.001
    //Stop
    if(deCasteljauRatio >= 1)
    {
      clearInterval(timer)
      return
    }
    $("#slider").val(deCasteljauRatio * $("#slider").prop('max'))
    drawCurves()
  }

  //Add point as last in polygon, coordinates are between 0 to 1
  //If isNewCurve is true create a new curve and add the point to it.
  //Otherwise adds the point to the current curve.
  function addPoint(newPoint)
  {
    if (curves.length > 0)
    {
      curves[currentCurveId].points.push(newPoint)
      resize()
      return
    }
    curves.push({
      points : [newPoint],
      startT : 0,
      endT : 1
    })
    resize()
  }

  //Delete last point in polygon of the current curve.
  //remove curve if it has no points
  function deletePoint()
  {
    if (curves.length == 0)
    {
      return
    }
    pushToHistory()
    curves[currentCurveId].points.pop()
    //curve is empty, delete it
    if (curves[currentCurveId].points.length == 0)
    {
      curves.splice(currentCurveId, 1)
    }
    resize()
  }

  //Add to canvas lines and dots of given polygon
  // (polygon is open, last and first dots are not drawn)
  // used to draw the control polygon and the DeCasteljau skeleton
  function drawPolygon(polygonPoints, lineWidth, lineColor, dotColor)
  {
      curveCtx.lineWidth = lineWidth
      curveCtx.beginPath()
      curveCtx.moveTo(polygonPoints[0].x, height1 - polygonPoints[0].y)
      for (var i = 0; i < polygonPoints.length; i++)
      {
        //Dot
        curveCtx.strokeStyle = dotColor
        curveCtx.strokeRect(polygonPoints[i].x - plotWidth,
                            height1 - polygonPoints[i].y - plotWidth,
                            doublePlotWidth,
                            doublePlotWidth)
        curveCtx.stroke()
        //Line
        curveCtx.strokeStyle = lineColor
        curveCtx.lineTo(polygonPoints[i].x, height1 - polygonPoints[i].y)
        curveCtx.stroke()
      }
  }

  //Draw all curves on the canvas using drawCurves function
  function drawCurves()
  {
    curveCtx.clearRect(0,0, width, height)
    for (var i = 0; i < curves.length; i++)
    {
      drawCurve(curves[i], i == currentCurveId)
    }
    if (deCasteljauRatio == 1)
    {
      return
    }
    //Write the t value
    curveCtx.font="30px Courier New"
    var roundT = (Math.round(deCasteljauRatio*100)/100)
    curveCtx.fillText("t=".concat(roundT), 30, 30)
  }

  //Adds to canvas a single curve (color are stronger if isCurrent is true)
  //Draw:
  // Control polygon
  // Bezier curve (using the DeCasteljau function for the calculation)
  // DeCasteljau skeleton (only if current DeCasteljau value is in the curve range)
  function drawCurve(curve, isCurrent)
  {
    var step = 1 / width
    var points = []
    //Set x,y in canvas coordinates, plot control points
    for (var i = 0; i < curve.points.length; i++)
    {
      points[i] = {
        x : curve.points[i].x * width,
        y : curve.points[i].y * height1
      }
    }

    //plot control polygon lines
    curveCtx.lineWidth = plotWidth
    //disabled colors
    var lineColor = "#e0e0e0"
    var dotColor = "#a0a0a0"
    if (isCurrent)
    {
      //enabled colors
      lineColor = "#0000f5"
      dotColor = "#0000f0"
    }
    drawPolygon(points, plotWidth, lineColor, dotColor)

    //plot curve
    curveCtx.lineWidth = doublePlotWidth

    var startCurve = deCasteljau(points, t).pop()[0]
    var lastStep = startCurve
    var curveColor = "#a04040"
    if (isCurrent)
    {
      curveColor = "#f00000"
    }
    //Draw Curve step
    for (var t = curve.startT; t < curve.endT; t += step)
    {
      curveStep = deCasteljau(points, t).pop()[0]
      curveCtx.strokeStyle = curveColor
      curveCtx.beginPath()
      curveCtx.moveTo(lastStep.x, height1 - lastStep.y)
      curveCtx.lineTo(curveStep.x, height1 - curveStep.y)
      curveCtx.stroke()
      lastStep = curveStep
    }
    //Draw De Casteljau skeleton
    if (deCasteljauRatio > curve.startT && deCasteljauRatio < curve.endT)
    {
      var deCasteljauPoints = deCasteljau(points, deCasteljauRatio)
      for (var j = 1; j < deCasteljauPoints.length; j++)
      {
        drawPolygon(deCasteljauPoints[j], plotWidth, "#00f000", "#0f0f0f")
      }
    }
  }

  //Receive points of control polygon and the t parameter of the Bezier function
  //Return array of arrays of the DeCasteljau points by order:
  //0 - the control points (n points)
  //1 - first level of the skeleton points (n-1 points)
  //...
  //n-1 - the curve point (1 point)
  function deCasteljau(points, t)
  {
    var skeletonPoints = []
    //first run - the control points
    skeletonPoints[0] = points

    //"recursive" runs of the algorithm (implemented not recursively)
    for (var j = 1; j < points.length; j++)
    {
      skeletonPoints[j] = []
      //Skeleton points in current iteration
      for (var i = 0; i < points.length - j; i++)
      {
        skeletonPoints[j][i] = {
          x : (1 - t) * skeletonPoints[j-1][i].x + t * skeletonPoints[j-1][i + 1].x,
          y : (1 - t) * skeletonPoints[j-1][i].y + t * skeletonPoints[j-1][i + 1].y
        }
      }
    }
    return skeletonPoints
  }

  function resize()
  {
    height = width = Math.round(window.innerWidth * scale)
    height1 = height-1
    plotWidth = Math.max(1, Math.round(width / 250))
    doublePlotWidth = 2 * plotWidth
    curveCanvas.width = width
    curveCanvas.height = height
    drawCurves()
  }


  function drag(ev)
  {
    if (curves.length == 0)
    {
      return
    }
    //No point is chosen
    if (dragId < 0) return
    curves[currentCurveId].points[dragId] = getXY(ev)
    drawCurves()
    ev.preventDefault()
  }

  function calcDistanceSquare(a, b)
  {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)
  }

  function startDrag(ev)
  {
    pushToHistory()
    var clickCoordinates = getXY(ev)
    if (ev.ctrlKey)
    {
      addPoint(clickCoordinates)
      return
    }

    if (curves.length == 0)
    {
      return
    }

    //Get closest point to the click
    var minimumDistance = width, distanceSquare, xDelta, yDelta
    for (var i = 0; i < curves[currentCurveId].points.length; i++)
    {
      distanceSquare = calcDistanceSquare(clickCoordinates, curves[currentCurveId].points[i]);
      if ( distanceSquare < minimumDistance )
      {
        dragId = i
        minimumDistance = distanceSquare
      }
    }
    curves[currentCurveId].points[dragId] = clickCoordinates
    drawCurves()
    ev.preventDefault()
  }

  function stopDrag(ev)
  {

    dragId = -1
    ev.preventDefault()
  }

  //Get x,y between 0 to 1 of given click event
  function getXY(ev)
  {
    if (!ev.clientX)
    {
      ev = ev.touches[0]
    }
    var rect = curveCanvas.getBoundingClientRect()
    return {
      x : (ev.clientX - rect.left) / width,
      y : (height1 - (ev.clientY - rect.top)) / height
    }
  }
}
