$( document ).ready(function()
{
  main( .4, [[[{x:.5,y:.5},{x:.5,y:.6}],[{x:.6,y:.5},{x:.6,y:.6}]],
             [[{x:.2,y:.2},{x:.2,y:.4}],[{x:.4,y:.2},{x:.4,y:.4}]]])
})


function main(scale, inputSurfaces)
{
  var HISTORY_MAX_SIZE = 50
  var history = [], forwardHistory = []
  var timer, deCasteljauRatio = 1
  var surfaces
  var pointOnSurface = -1
  var currentSurfaceId = 0
  var physicalCanvas, physicalCtx
  var parameterCanvas, parameterCtx
  var width, height, height1, plotWidth, doublePlotWidth,  dragId = -1
  var iColor = ["#f00000","#00f000","#0000f0","#00f0f0","#f0f000","#f000f0","#090909"]
  init()
  resize()

  function init()
  {
    surfaces = inputSurfaces

    updateSurfacesList()
    $("#slider").value = $("#slider").max
    physicalCanvas = $("#physicalCanvas").get(0)
    physicalCtx = physicalCanvas.getContext("2d")
    parameterCanvas = $("#parameterCanvas").get(0)
    parameterCtx = parameterCanvas.getContext("2d")
    $("#fileInput").change(loadSurfaces)
    $("#downloadButton").click(saveSurfaces)
    $("#surfacesList").change(changeCurrentSurface)
    $("#parameterCanvas").mousemove(mouseMoveParameter)
    $("#parameterCanvas").mouseup(mouseUpParameter)
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
    forwardHistory.push(surfaces)

    surfaces = history.pop()
    if (currentSurfaceId >= surfaces.length)
    {
      currentSurfaceId = 0
    }
    updateSurfacesList()
    resize()
  }

  function redo()
  {
    if (forwardHistory.length == 0)
    {
      return
    }
    history.push(surfaces)
    surfaces = forwardHistory.pop()
    if (currentSurfaceId >= surfaces.length)
    {
      currentSurfaceId = 0
    }
    updateSurfacesList()
    resize()
  }

  function pushToHistory()
  {
    //Deep copy
    var surfacesCopy = []
    for (var k = 0; k < surfaces.length; k++)
    {
      var surfaceCopy = []
      for (var i = 0; i < surfaces[k].length; i++)
      {
        var curveCopy = []
        for (var j = 0; j < surfaces[k][i].length; j++)
        {
          curveCopy.push($.extend({}, surfaces[k][i][j]))
        }
        surfaceCopy.push(curveCopy)
      }
      surfacesCopy.push(surfaceCopy)
    };

    history.push(surfacesCopy)
    //Keep history size limited
    if (history.length > HISTORY_MAX_SIZE)
    {
      history.shift()
    }
    forwardHistory = []
  }
// meeting point is on the original curve at the deCasteljau as t parameter.
  function splitCurve(curve, t)
  {
    var skeletonPoints = deCasteljau(curve, t)
    //build two curves
    var postfixCurve = []
    var prefixCurve = []
    //add points to new curves
    for (var i = 0; i < curve.length; i++)
    {
      prefixCurve.push(skeletonPoints[i][0])
      postfixCurve.push(skeletonPoints[curve.length - i - 1][i])
    }
    //add new curves to the curves list
    return [prefixCurve, postfixCurve]
  }

  function updateSurfacesList()
  {
    //remake list element in HTML
    $('#surfacesList').empty()
    for (var i=1; i <= surfaces.length; i++)
    {
      if (i==1)
      {
        $("#surfacesList").append($("<option selected/>").text(i))
      }
      else
      {
        $("#surfacesList").append($("<option />").text(i))
      }
    }

    //Make sure the current curve is selected
    if($("#surfacesList option").size() > currentSurfaceId)
    {
      $("#surfacesList").val(currentSurfaceId + 1)
      return
    }
    //select first curve
    $("#surfacesList").val(1)
  }

  function changeCurrentSurface()
  {
    currentSurfaceId = $("#surfacesList")[0].selectedIndex
    pointOnSurface = -1
    resize()
  }
  //Load surfaces from file which is selected in "browse..." element
  function loadSurfaces(ev) {
    var file = $("#fileInput")[0].files[0]; // FileList object
    var reader = new FileReader()

    // Closure to capture the file information.
    reader.onload = function(e)
    {
      pushToHistory()
      surfaces = JSON.parse(reader.result)
      resize()
    }

    // Read in the image file as a data URL.
    reader.readAsText(file)
  }


  //download current surfaces in JSON format
  function saveSurfaces()
  {
    download("surfaces.json", JSON.stringify(surfaces))
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
        splitSurfaceByPoint()
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
      //N
      case 78:
        currentSurfaceId++
        if (currentSurfaceId == surfaces.length)
        {
          currentSurfaceId = 0
        }
        updateSurfacesList()
        resize()
        break
    }
  }

  function splitSurfaceByPoint()
  {
    if (pointOnSurface == -1)
    {
      return
    }
    pushToHistory()
    surface = surfaces[currentSurfaceId]
    var newSurfaces = splitSurface(surface, pointOnSurface.x, pointOnSurface.y)
    surfaces.splice(currentSurfaceId, 1, newSurfaces[0], newSurfaces[1], newSurfaces[2], newSurfaces[3])

    updateSurfacesList()
    resize()
  }
  //If deCasteljauRatio is in the current curve range, make the current curve
  // into two surfaces with the exact same shape as the current curve, where their
  // meeting point is on the original curve at the deCasteljau as t parameter.
  function splitSurface(surface, u, v)
  {
    var semiSurfaces = [[], []]
    for (var i = 0; i < surface.length; i++)
    {
      var subCurves = splitCurve(surface[i], u)
      semiSurfaces[0].push(subCurves[0])
      semiSurfaces[1].push(subCurves[1])
    }
    var quadSurfaces = [[], [], [], []]
    for (var i = 0; i < semiSurfaces[0][0].length; i++)
    {
      var subCurves = splitCurve(getColumn(semiSurfaces[0], i), v)
      quadSurfaces[0].push(subCurves[0])
      quadSurfaces[1].push(subCurves[1])
    }

    for (var i = 0; i < semiSurfaces[1][0].length; i++)
    {
      var subCurves = splitCurve(getColumn(semiSurfaces[1], i), v)
      quadSurfaces[2].push(subCurves[0])
      quadSurfaces[3].push(subCurves[1])
    }
    return quadSurfaces
  }

  function transposeSurface(surface)
  {
    var transposedSurface = []
    for (var i = 0; i < surface[0].length; i++)
    {
      transposedSurface.push(getColumn(surface, i))
    }
    return transposedSurface
  }

  //Add point as last in polygon, coordinates are between 0 to 1
  //If isNewCurve is true create a new curve and add the point to it.
  //Otherwise adds the point to the current curve.
  function addPoint(clickPoint, addRow)
  {
    //handle empty canvas
    if (surfaces.length == 0)
    {
      surfaces = [[[clickPoint]]]
      currentSurfaceId = 0
      updateSurfacesList()
      resize()
      return
    }
    surface = surfaces[currentSurfaceId]
    if (addRow)
    {
      surface = transposeSurface(surface)
    }
    var pointsLength = surface.length

    //Find closest point on last column
    var minimumDistance = 10
    var minimumIndex = -1
    for(var i = 0; i < surface[0].length; i++)
    {
      var distance = calcDistanceSquare(clickPoint, surface[pointsLength - 1][i])
      if (distance < minimumDistance)
      {
        minimumDistance = distance
        minimumIndex = i
      }
    }
    //get distance from closest point
    var diffY = clickPoint.y - surface[pointsLength - 1][minimumIndex].y
    var diffX = clickPoint.x - surface[pointsLength - 1][minimumIndex].x
    //add column
    var newColumn = []
    for(var i = 0; i < surface[0].length; i++)
    {
      newColumn.push({
        x : surface[pointsLength - 1][i].x + diffX,
        y : surface[pointsLength - 1][i].y + diffY
      })
    }
    surface.push(newColumn)
    if (addRow)
    {
      surface = transposeSurface(surface)
    }
    surfaces[currentSurfaceId] = surface
    resize()
    return
  }


  //Delete last point in polygon of the current curve.
  //remove curve if it has no points
  function deletePoint(deleteRow)
  {
    if (surfaces.length == 0)
    {
      return
    }
    pushToHistory()
    if (!deleteRow)
    {
      surfaces[currentSurfaceId].pop()
    }
    else
    {
      for (var i = 0; i < surfaces[currentSurfaceId].length; i++)
      {
        surfaces[currentSurfaceId][i].pop()
      }
    }
    if (surfaces[currentSurfaceId].length == 0)
    {
      surfaces.splice(currentSurfaceId, 1)
      if (currentSurfaceId > 0)
      {
        currentSurfaceId--
      }
      updateSurfacesList()
    }

    resize()
  }
  function drawParameterGrid()
  {
    if (surfaces.length == 0 || surfaces[currentSurfaceId].length == 0 )
    {
      return
    }

    for (var u = 0; u <= 1; u += 1 / (surfaces[currentSurfaceId].length - 1))
    {
      drawParameterLine(u, true, "#f00000");
    }
    for (var v = 0; v <= 1; v += 1 / (surfaces[currentSurfaceId][0].length - 1))
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

  function drawSurfaces()
  {
    physicalCtx.clearRect(0,0, width, height)
    while(isExceedingCanvas())
    {
      correctZoom()
    }
    for (var i = 0; i < surfaces.length; i++)
    {
      if (i != currentSurfaceId)
      {
        drawSurface(surfaces[i], false)
      }
    }
    drawSurface(surfaces[currentSurfaceId], true)
    if (pointOnSurface != -1)
    {
      drawParameterLine(pointOnSurface.x, false, "#f000f0")
      drawParameterLine(pointOnSurface.y, true, "#f000f0")
      plotCurveOnSurface(convertToCanvasSpace(surfaces[currentSurfaceId]), pointOnSurface.x, false, "#f000f0");
      plotCurveOnSurface(convertToCanvasSpace(surfaces[currentSurfaceId]), pointOnSurface.y, true, "#f000f0");
    }
  }

  function drawSurface(surface, isCurrent)
  {
    if (surface.length == 0 || surface[0].length == 0)
    {
      return
    }
    surface = convertToCanvasSpace(surface)

    //disabled colors
    var lineColor = "#e0e0e0"
    var dotColor = "#a0a0a0"
    if (isCurrent)
    {
      //enabled colors
      lineColor = "#0000f5"
      dotColor = "#0000f0"
    }
    for (var i = 0; i < surface[0].length; i++)
    {
      drawPolygon(getColumn(surface, i), plotWidth, lineColor, dotColor)
    }
    for (var i = 0; i < surface.length; i++)
    {
      drawPolygon(surface[i], plotWidth, lineColor, dotColor)
    }
    //plot curve
    var curveColor = "#a04040"
    if (isCurrent)
    {
      curveColor = "#f00000"
    }
    for (var u = 0; u <= 1; u += 1 / (surface.length - 1))
    {
      plotCurveOnSurface(surface, u, true, curveColor);
    }

    for (var v = 0; v <= 1; v += 1 / (surface[0].length - 1))
    {
      plotCurveOnSurface(surface, v, false, curveColor);
    }
  }

  function plotCurveOnSurface(surface, value, isHorizontal, curveColor)
  {
    physicalCtx.lineWidth = doublePlotWidth
    var step = 1 / width
    var lastStep

    if (isHorizontal)
    {
      lastStep = tensor(surface, value, 0).pop()[0][0]
    }
    else
    {
      lastStep = tensor(surface, 0, value).pop()[0][0]
    }

    //Draw Curve step
    for (var t = 0; t < 1; t += step)
    {
      if (isHorizontal)
      {
        curveStep = tensor(surface, value, t).pop()[0][0]
      }
      else
      {
        curveStep = tensor(surface, t, value).pop()[0][0]
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


  function tensor(surface, u, v)
  {
    //De Casteljau with 2 parameters
    var skeletonPoints = [surface]
    for (var k = 0; k < Math.min(surface.length, surface[0].length) - 1; k++)
    {
      //De Casteljau iteration
      nextStepSkeleton = []
      for (var i = 0; i < skeletonPoints[k].length - 1; i++)
      {
        nextStepSkeletonRow = []
        for (var j = 0; j < skeletonPoints[k][0].length - 1; j++)
        {
          nextStepSkeletonRow.push({
            x : skeletonPoints[k][i][j].x * (1 - u) * (1 - v)+
                skeletonPoints[k][i + 1][j].x * u * (1 - v) +
                skeletonPoints[k][i][j + 1].x * (1 - u) * v +
                skeletonPoints[k][i + 1][j + 1].x * u * v,
            y : skeletonPoints[k][i][j].y * (1 - u) * (1 - v)+
                skeletonPoints[k][i + 1][j].y * u * (1 - v) +
                skeletonPoints[k][i][j + 1].y * (1 - u) * v +
                skeletonPoints[k][i + 1][j + 1].y * u * v
          })
        }
        nextStepSkeleton.push(nextStepSkeletonRow)
      }
      skeletonPoints.push(nextStepSkeleton)
    }
    //Last decasteljau steps, now it's a curve - not a surface
    //If more rows than columns in given points matrix
    if (skeletonPoints[skeletonPoints.length - 1].length > 1)
    {
      var skeletonCurve = deCasteljau(getColumn(skeletonPoints.pop(), 0), u)
      for (var i = 0; i < skeletonCurve.length; i++)
      {
        skeletonPoints.push([skeletonCurve[i]])
      }
      return skeletonPoints
    }
    //If more columns than rows in given points matrix
    if (skeletonPoints[skeletonPoints.length - 1][0].length > 1)
    {
      var skeletonCurve = deCasteljau(skeletonPoints.pop()[0], v)
      for (var i = 0; i < skeletonCurve.length; i++)
      {
        skeletonPoints.push([skeletonCurve[i]])
      }
      return skeletonPoints
    }
    //If given matrix was square
    return skeletonPoints
  }

  function getColumn(matrix, index)
  {
    row = []
    for (var i = 0; i < matrix.length; i++)
    {
      row.push(matrix[i][index])
    }
    return row
  }

  function isExceedingCanvas()
  {
    for (var k = 0; k < surfaces.length; k++)
    {
      for (var i = 0; i < surfaces[k].length; i++)
      {
        for (var j = 0; j < surfaces[k][i].length; j++)
        {
          if (surfaces[k][i][j].x < 0 || surfaces[k][i][j].x > 1 ||
              surfaces[k][i][j].y < 0 || surfaces[k][i][j].y > 1)
            return true
        }
      }
    }
    return false
  }

  function correctZoom()
  {
    for (var k = 0; k < surfaces.length; k++)
    {
      for (var i = 0; i < surfaces[k].length; i++)
      {
        for (var j = 0; j < surfaces[k][i].length; j++)
        {
          surfaces[k][i][j].x -= .5
          surfaces[k][i][j].x *= .9
          surfaces[k][i][j].x += .5
          surfaces[k][i][j].y -= .5
          surfaces[k][i][j].y *= .9
          surfaces[k][i][j].y += .5
        }
      }
    }
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
    drawSurfaces()
    drawParameterGrid()
  }


  function drag(ev)
  {
    if (surfaces.length == 0)
    {
      return
    }
    //No point is chosen
    if (dragId == -1) return
    surfaces[currentSurfaceId][dragId.i][dragId.j] = getXY(ev, physicalCanvas)
    drawSurfaces()
    ev.preventDefault
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

    if (surfaces.length == 0 || surfaces[currentSurfaceId].length == 0)
    {
      return
    }

    //Get closest point to the click
    var minimumDistance = width, distanceSquare, xDelta, yDelta
    for (var i = 0; i < surfaces[currentSurfaceId].length; i++)
    {
      for (var j = 0; j < surfaces[currentSurfaceId][0].length; j++)
      {
        distanceSquare = calcDistanceSquare(clickCoordinates, surfaces[currentSurfaceId][i][j]);
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
    surfaces[currentSurfaceId][dragId.i][dragId.j] = clickCoordinates
    drawSurfaces()
    ev.preventDefault()
  }

  function stopDrag(ev)
  {
    dragId = -1
    ev.preventDefault()
  }

  function mouseUpParameter(ev)
  {
    pointOnSurface = getXY(ev, parameterCanvas)
    resize()
  }
  function mouseMoveParameter(ev)
  {
    if (surfaces.length == 0 || surfaces[currentSurfaceId].length == 0)
    {
      resize()
      return
    }
    point = getXY(ev, parameterCanvas)
    resize()
    drawParameterLine(point.x, false, "#00f000")
    drawParameterLine(point.y, true, "#00f000")
    plotCurveOnSurface(convertToCanvasSpace(surfaces[currentSurfaceId]), point.x, false, "#00f000");
    plotCurveOnSurface(convertToCanvasSpace(surfaces[currentSurfaceId]), point.y, true, "#00f000");
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
