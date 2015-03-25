$( document ).ready(function()
{
  main( .4, [{x:.5,y:.5}])
})


function main(scale, points)
{
  var HISTORY_MAX_SIZE = 50
  var history = [], forwardHistory = []
  var timer, deCasteljauRatio = 1
  var curves
  var physicalCanvas, physicalCtx
  var parameterCanvas, parameterCtx
  var width, height, height1, plotWidth, doublePlotWidth,  dragId = -1
  var iColor = ["#f00000","#00f000","#0000f0","#00f0f0","#f0f000","#f000f0","#090909"]
  init()
  resize()

  function init()
  {
    curves = [points]

    $("#slider").value = $("#slider").max
    physicalCanvas = $("#physicalCanvas").get(0)
    physicalCtx = physicalCanvas.getContext("2d")
    parameterCanvas = $("#parameterCanvas").get(0)
    parameterCtx = parameterCanvas.getContext("2d")
    $("#fileInput").change(loadCurves)
    $("#downloadButton").click(saveCurves)
    $("#parameterCanvas").mousemove(mouseMoveParameter)
    $("#physicalCanvas").mousemove(drag)
    $("#physicalCanvas").mousedown(startDrag)
    $("#physicalCanvas").mouseup(stopDrag)
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
    resize()
  }

  function pushToHistory()
  {
    //Deep copy
    curvesCopy = []
    for (var i = 0; i < curves.length; i++)
    {
      curveCopy = []
      for (var j = 0; j < curves[i].length; j++)
      {
        curveCopy.push($.extend({}, curves[i][j]))
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
        deletePoint(ev.ctrlKey)
        break
      //S
      case 83:
        splitCurve()
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

  //Add point as last in polygon, coordinates are between 0 to 1
  //If isNewCurve is true create a new curve and add the point to it.
  //Otherwise adds the point to the current curve.
  function addPoint(clickPoint, isNewCurve)
  {
    if (!isNewCurve && curves.length > 0)
    {
      var pointsLength = curves[0].length
      var diffY = clickPoint.y - curves[0][pointsLength - 1].y
      var diffX = clickPoint.x - curves[0][pointsLength - 1].x
      for(var i = 0; i < curves.length; i++)
      {
        var newPoint = {
          x : curves[i][curves[i].length - 1].x + diffX,
          y : curves[i][curves[i].length - 1].y + diffY
        }
        curves[i].push(newPoint)
      }
      resize()
      return
    }
    if (curves.length == 0)
    {
      //canvas is empty, add single point as surface
      curves.push([newPoint])
    }
    else
    {
      //Generate a copy of the last curve
      var diffY = clickPoint.y - curves[curves.length - 1][0].y
      var diffX = clickPoint.x - curves[curves.length - 1][0].x
      var newCurve = []
      for (var i = 0; i < curves[curves.length - 1].length; i++)
      {
        newCurve.push({
          x : curves[curves.length - 1][i].x + diffX,
          y : curves[curves.length - 1][i].y + diffY,
        })
      }
      curves.push(newCurve)
    }
    resize()
  }

  //Delete last point in polygon of the current curve.
  //remove curve if it has no points
  function deletePoint(deleteCurve)
  {
    if (deleteCurve)
    {
      curves.pop()
      resize()
      return
    }
    if (curves.length == 0)
    {
      return
    }
    pushToHistory()
    for (var i = 0; i < curves.length; i++)
    {
      curves[i].pop()
    }
    resize()
  }
  function drawParameterGrid(points)
  {
    for (var u = 0; u <= 1; u += 1 / (points.length - 1))
    {
      drawParameterLine(u, true, "#f00000");
    }
    for (var v = 0; v <= 1; v += 1 / (points[0].length - 1))
    {
      drawParameterLine(v, false, "#f00000");
    }
  }

  function drawParameterLine(value, isHorizontal, lineColor)
  {
    parameterCtx.lineWidth = plotWidth
    parameterCtx.strokeStyle = lineColor
    parameterCtx.beginPath()
    if (isHorizontal)
    {
      parameterCtx.moveTo(0, height1 * (1 - value))
      parameterCtx.lineTo(width, height1 * (1 - value))
    }
    else
    {
      parameterCtx.moveTo(width * value, 0)
      parameterCtx.lineTo(width * value, height)
    }
    parameterCtx.stroke()
  }

  //Add to canvas lines and dots of given polygon
  // (polygon is open, last and first dots are not drawn)
  // used to draw the control polygon and the DeCasteljau skeleton
  function drawPolygon(polygonPoints, lineWidth, lineColor, dotColor)
  {
      physicalCtx.lineWidth = lineWidth
      physicalCtx.beginPath()
      physicalCtx.moveTo(polygonPoints[0].x, height1 - polygonPoints[0].y)
      for (var i = 0; i < polygonPoints.length; i++)
      {
        //Dot
        physicalCtx.strokeStyle = dotColor
        physicalCtx.strokeRect(polygonPoints[i].x - plotWidth,
                            height1 - polygonPoints[i].y - plotWidth,
                            doublePlotWidth,
                            doublePlotWidth)
        physicalCtx.stroke()
        //Line
        physicalCtx.strokeStyle = lineColor
        physicalCtx.lineTo(polygonPoints[i].x, height1 - polygonPoints[i].y)
        physicalCtx.stroke()
      }
  }

  function convertToCanvasSpace(surface)
  {
    var newSurface = []
    for (var i = 0; i < surface.length; i++)
    {
      var newRow = []
      for (var j = 0; j < surface[0].length; j++)
      {
        newRow.push({
          x : surface[i][j].x * width,
          y : surface[i][j].y * height1
        })
      }
      newSurface.push(newRow)
    }
    return newSurface
  }

  function drawSurface(points, isCurrent)
  {
    if (points.length == 0 || points[0].length == 0)
    {
      return
    }
    physicalCtx.clearRect(0,0, width, height)
    var points = convertToCanvasSpace(points)

    //disabled colors
    var lineColor = "#e0e0e0"
    var dotColor = "#a0a0a0"
    if (isCurrent)
    {
      //enabled colors
      lineColor = "#0000f5"
      dotColor = "#0000f0"
    }
    for (var i = 0; i < points[0].length; i++)
    {
      drawPolygon(getRow(points, i), plotWidth, lineColor, dotColor)
    }
    for (var i = 0; i < points.length; i++)
    {
      drawPolygon(points[i], plotWidth, lineColor, dotColor)
    }
    //plot curve
    var curveColor = "#a04040"
    if (isCurrent)
    {
      curveColor = "#f00000"
    }
    for (var u = 0; u <= 1; u += 1 / (points.length - 1))
    {
      plotCurveOnSurface(points, u, true, curveColor);
    }

    for (var v = 0; v <= 1; v += 1 / (points[0].length - 1))
    {
      plotCurveOnSurface(points, v, false, curveColor);
    }
  }
  function plotCurveOnSurface(points, value, isHorizontal, curveColor)
  {
    physicalCtx.lineWidth = doublePlotWidth
    var step = 1 / width
    var lastStep
    if (isHorizontal)
    {
      lastStep = tensor(points, value, 0)
    }
    else
    {
      lastStep = tensor(points, 0, value)
    }

    //Draw Curve step
    for (var t = 0; t < 1; t += step)
    {
      if (isHorizontal)
      {
        curveStep = tensor(points, value, t)
      }
      else
      {
        curveStep = tensor(points, t, value)
      }
      physicalCtx.strokeStyle = curveColor
      physicalCtx.beginPath()
      physicalCtx.moveTo(lastStep.x, height1 - lastStep.y)
      physicalCtx.lineTo(curveStep.x, height1 - curveStep.y)
      physicalCtx.stroke()
      lastStep = curveStep
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


  function tensor(points, u, v)
  {
    //De Casteljau with 2 parameters
    var skeletonPoints = points
    for (var k = 1; k < Math.min(points.length, points[0].length); k++)
    {
      //De Casteljau iteration
      nextStepSkeleton = []
      for (var i = 0; i < skeletonPoints.length - 1; i++)
      {
        nextStepSkeletonRow = []
        for (var j = 0; j < skeletonPoints[0].length - 1; j++)
        {
          nextStepSkeletonRow.push({
            x : skeletonPoints[i][j].x * (1 - u) * (1 - v)+
                skeletonPoints[i + 1][j].x * u * (1 - v) +
                skeletonPoints[i][j + 1].x * (1 - u) * v +
                skeletonPoints[i + 1][j + 1].x * u * v,
            y : skeletonPoints[i][j].y * (1 - u) * (1 - v)+
                skeletonPoints[i + 1][j].y * u * (1 - v) +
                skeletonPoints[i][j + 1].y * (1 - u) * v +
                skeletonPoints[i + 1][j + 1].y * u * v
          })
        }
        nextStepSkeleton.push(nextStepSkeletonRow)
      }
      skeletonPoints = nextStepSkeleton

    }
    //Last decasteljau steps, now it's a curve - not a surface
    //If more rows than columns in given points matrix
    if (skeletonPoints.length > 1)
    {
      return deCasteljau(getRow(skeletonPoints, 0), u).pop()[0]
    }
    //If more columns than rows in given points matrix
    if (skeletonPoints[0].length > 1)
    {
      return deCasteljau(skeletonPoints[0], v).pop()[0]
    }
    //If given matrix was square
    return skeletonPoints[0][0]
  }

  function getRow(matrix, index)
  {
    row = []
    for (var i = 0; i < matrix.length; i++)
    {
      row.push(matrix[i][index])
    }
    return row
  }

  function resize()
  {
    height = width = Math.round(window.innerWidth * scale)
    height1 = height-1
    plotWidth = Math.max(1, Math.round(width / 250))
    doublePlotWidth = 2 * plotWidth
    physicalCanvas.width = width
    physicalCanvas.height = height
    parameterCanvas.width = width
    parameterCanvas.height = height
    drawSurface(curves, true)
    drawParameterGrid(curves)
  }


  function drag(ev)
  {
    if (curves.length == 0)
    {
      return
    }
    //No point is chosen
    if (dragId == -1) return
    curves[dragId.i][dragId.j] = getXY(ev, physicalCanvas)
    drawSurface(curves, true)
    ev.preventDefault()
  }

  function calcDistanceSquare(a, b)
  {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)
  }

  function startDrag(ev)
  {
    pushToHistory()
    var clickCoordinates = getXY(ev, physicalCanvas)
    if (ev.ctrlKey)
    {
      addPoint(clickCoordinates, ev.shiftKey)
      return
    }

    if (curves.length == 0)
    {
      return
    }

    //Get closest point to the click
    var minimumDistance = width, distanceSquare, xDelta, yDelta
    for (var i = 0; i < curves.length; i++)
    {
      for (var j = 0; j < curves[0].length; j++)
      {
        distanceSquare = calcDistanceSquare(clickCoordinates, curves[i][j]);
        if ( distanceSquare < minimumDistance )
        {
          dragId = {
            i : i,
            j : j
          }
          minimumDistance = distanceSquare
        }
      }
    }
    curves[dragId.i][dragId.j] = clickCoordinates
    drawSurface(curves, true)
    ev.preventDefault()
  }

  function stopDrag(ev)
  {

    dragId = -1
    ev.preventDefault()
  }

  function mouseMoveParameter(ev)
  {
    point = getXY(ev, parameterCanvas)
    resize()
    drawParameterLine(point.x, false, "#00f000")
    drawParameterLine(point.y, true, "#00f000")
    plotCurveOnSurface(convertToCanvasSpace(curves), point.x, false, "#00f000");
    plotCurveOnSurface(convertToCanvasSpace(curves), point.y, true, "#00f000");
  }

  //Get x,y between 0 to 1 of given click event
  function getXY(ev, canvas)
  {
    if (!ev.clientX)
    {
      ev = ev.touches[0]
    }
    var rect = canvas.getBoundingClientRect()
    return {
      x : (ev.clientX - rect.left) / width,
      y : (height1 - (ev.clientY - rect.top)) / height
    }
  }
}
