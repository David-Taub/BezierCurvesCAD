$( document ).ready(function()
{
  var surface = {
    "name" : "1",
    "points" : [[{"x":0.13,"y":0.55},{"x":0.25,"y":0.50},{"x":0.19,"y":0.38},{"x":0.06,"y":0.37}],
                [{"x":0.53,"y":0.84},{"x":0.45,"y":0.52},{"x":0.36,"y":0.43},{"x":0.19,"y":0.14}],
                [{"x":0.86,"y":0.43},{"x":0.72,"y":0.34},{"x":0.60,"y":0.17},{"x":0.77,"y":0.14}]]
    }
  main( .4, [surface])
})


function main(scale, inputSurfaces)
{
  var HISTORY_MAX_SIZE = 50
  var history = [], forwardHistory = []
  var timer, deCasteljauRatio = 1
  var surfaces
  var pointOnSurface = -1
  var mouseOnSurface = -1
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
    shouldDrawSkeleton = true
    updateSurfacesList()
    physicalCanvas = $("#physicalCanvas").get(0)
    physicalCtx = physicalCanvas.getContext("2d")
    parameterCanvas = $("#parameterCanvas").get(0)
    parameterCtx = parameterCanvas.getContext("2d")
    $("#fileInput").change(loadSurfaces)
    $("#downloadButton").click(saveSurfaces)
    $("#surfacesList").change(changeCurrentSurface)
    $("#parameterCanvas").mousemove(mouseMoveParameter)
    $("#parameterCanvas").mouseleave(function () {mouseOnSurface = -1;resize()})
    $("#parameterCanvas").mouseup(mouseUpParameter)
    $("#physicalCanvas").mousemove(drag)
    $("#physicalCanvas").mousedown(startDrag)
    $("#physicalCanvas").mouseup(stopDrag)
    $("input:radio").change(resize)
    //Mobile support
    $(document).keyup(onKeyUp)
    $(window).resize(resize)
    $("#radio10").prop("checked", true)
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
      var surfaceCopy = {
        name : surfaces[k].name,
        points : []
      }
      for (var i = 0; i < surfaces[k].points.length; i++)
      {
        var curveCopy = []
        for (var j = 0; j < surfaces[k].points[i].length; j++)
        {
          curveCopy.push($.extend({}, surfaces[k].points[i][j]))
        }
        surfaceCopy.points.push(curveCopy)
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
    for (var i=0; i < surfaces.length; i++)
    {
      if (i==1)
      {
        $("#surfacesList").append($("<option selected/>").text(surfaces[i].name))
      }
      else
      {
        $("#surfacesList").append($("<option />").text(surfaces[i].name))
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
      //C
      case 67:
        shouldDrawSkeleton = !shouldDrawSkeleton
        resize()
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
    for (var i = 0; i < surface.points.length; i++)
    {
      var subCurves = splitCurve(surface.points[i], u)
      semiSurfaces[0].push(subCurves[0])
      semiSurfaces[1].push(subCurves[1])
    }
    var quadSurfaces = [{
                        name : surface.name + ".1",
                        points : []
                      },
                      {
                        name : surface.name + ".2",
                        points : []
                      },
                      {
                        name : surface.name + ".3",
                        points : []
                      },
                      {
                        name : surface.name + ".4",
                        points : []
                      }]

    for (var i = 0; i < semiSurfaces[0][0].length; i++)
    {
      var subCurves = splitCurve(getColumn(semiSurfaces[0], i), v)
      quadSurfaces[0].points.push(subCurves[0])
      quadSurfaces[1].points.push(subCurves[1])
    }

    for (var i = 0; i < semiSurfaces[1][0].length; i++)
    {
      var subCurves = splitCurve(getColumn(semiSurfaces[1], i), v)
      quadSurfaces[2].points.push(subCurves[0])
      quadSurfaces[3].points.push(subCurves[1])
    }
    return quadSurfaces
  }

  function transposeSurface(surface)
  {
    var transposedSurface = {
      name : surface.name,
      points : []
    }
    for (var i = 0; i < surface.points[0].length; i++)
    {
      transposedSurface.points.push(getColumn(surface.points, i))
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
    var pointsLength = surface.points.length

    //Find closest point on last column
    var minimumDistance = 10
    var minimumIndex = -1
    for(var i = 0; i < surface.points[0].length; i++)
    {
      var distance = calcDistanceSquare(clickPoint, surface.points[pointsLength - 1][i])
      if (distance < minimumDistance)
      {
        minimumDistance = distance
        minimumIndex = i
      }
    }
    //get distance from closest point
    var diffY = clickPoint.y - surface.points[pointsLength - 1][minimumIndex].y
    var diffX = clickPoint.x - surface.points[pointsLength - 1][minimumIndex].x
    //add column
    var newColumn = []
    for(var i = 0; i < surface.points[0].length; i++)
    {
      newColumn.push({
        x : surface.points[pointsLength - 1][i].x + diffX,
        y : surface.points[pointsLength - 1][i].y + diffY
      })
    }
    surface.points.push(newColumn)
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
      surfaces[currentSurfaceId].points.pop()
    }
    else
    {
      for (var i = 0; i < surfaces[currentSurfaceId].points.length; i++)
      {
        surfaces[currentSurfaceId].points[i].pop()
      }
    }
    if (surfaces[currentSurfaceId].points.length == 0 ||
        surfaces[currentSurfaceId].points[0].length == 0)
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

  function getLinesAmountInGrid()
  {
    return parseInt($("input[name=grid]:checked", "#gridForm").val())
  }

  function drawParameterGrid()
  {

    if (surfaces.length == 0 || surfaces[currentSurfaceId].points.length == 0 )
    {
      return
    }
    linesInGrid = getLinesAmountInGrid() + 1

    //for (var u = 0; u <= 1; u += 1 / (surfaces[currentSurfaceId].points.length - 1))
    for (var u = 0; u <= linesInGrid; u += 1 )
    {
      drawParameterLine(u / linesInGrid, true, "#f00000");
    }
    for (var v = 0; v <= linesInGrid; v += 1)
    {
      drawParameterLine(v / linesInGrid, false, "#f00000");
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
      physicalCtx.moveTo(polygonPoints[0].x * width, height1 * (1 - polygonPoints[0].y))
      for (var i = 0; i < polygonPoints.length; i++)
      {
        //Dot
        physicalCtx.strokeStyle = dotColor
        physicalCtx.strokeRect(polygonPoints[i].x * width - plotWidth,
                            height1 * (1 - polygonPoints[i].y) - plotWidth,
                            doublePlotWidth,
                            doublePlotWidth)
        physicalCtx.stroke()
        //Line
        physicalCtx.strokeStyle = lineColor
        physicalCtx.lineTo(polygonPoints[i].x * width, height1 * (1 - polygonPoints[i].y))
        physicalCtx.stroke()
      }
  }

  function drawSurfaces()
  {
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
      plotCurveOnSurface(surfaces[currentSurfaceId], pointOnSurface.x, false, "#f000f0");
      plotCurveOnSurface(surfaces[currentSurfaceId], pointOnSurface.y, true, "#f000f0");
    }
  }

  function drawSurface(surface, isCurrent)
  {

    if (surface.points.length == 0 || surface.points[0].length == 0)
    {
      return
    }
    //disabled colors
    var lineColor = "#e0e0e0"
    var dotColor = "#a0a0a0"
    if (isCurrent)
    {
      //enabled colors
      lineColor = "#0000f5"
      dotColor = "#0000f0"
    }
    for (var i = 0; i < surface.points[0].length; i++)
    {
      drawPolygon(getColumn(surface.points, i), doublePlotWidth, lineColor, dotColor)
    }
    for (var i = 0; i < surface.points.length; i++)
    {
      drawPolygon(surface.points[i], doublePlotWidth, lineColor, dotColor)
    }
    //plot curve
    var curveColor = "#a04040"
    if (isCurrent)
    {
      curveColor = "#f00000"
    }
    linesInGrid = getLinesAmountInGrid() + 1
    //for (var u = 0; u <= 1; u += 1 / (surface.points.length - 1))
    for (var u = 0; u <= linesInGrid; u += 1)
    {
      plotCurveOnSurface(surface, u / linesInGrid, true, curveColor);
    }

    //for (var v = 0; v <= 1; v += 1 / (surface.points[0].length - 1))
    for (var v = 0; v <= linesInGrid; v += 1)
    {
      plotCurveOnSurface(surface, v / linesInGrid, false, curveColor);
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
      physicalCtx.moveTo(lastStep.x * width, height1 * (1 - lastStep.y))
      physicalCtx.lineTo(curveStep.x * width, height1 * (1 - curveStep.y))
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
    var skeletonPoints = [surface.points]
    for (var k = 0; k < Math.min(surface.points.length, surface.points[0].length) - 1; k++)
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
      for (var i = 0; i < surfaces[k].points.length; i++)
      {
        for (var j = 0; j < surfaces[k].points[i].length; j++)
        {
          if (surfaces[k].points[i][j].x < 0 || surfaces[k].points[i][j].x > 1 ||
              surfaces[k].points[i][j].y < 0 || surfaces[k].points[i][j].y > 1)
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
      for (var i = 0; i < surfaces[k].points.length; i++)
      {
        for (var j = 0; j < surfaces[k].points[i].length; j++)
        {
          surfaces[k].points[i][j].x -= .5
          surfaces[k].points[i][j].x *= .9
          surfaces[k].points[i][j].x += .5
          surfaces[k].points[i][j].y -= .5
          surfaces[k].points[i][j].y *= .9
          surfaces[k].points[i][j].y += .5
        }
      }
    }
  }

  function resize()
  {

    physicalCtx.clearRect(0,0, width, height)

    parameterCtx.clearRect(0,0, width, height)
    height = width = Math.round(window.innerWidth * scale)
    height1 = height-1
    plotWidth = Math.max(1, Math.round(width / 250))
    doublePlotWidth = 2 * plotWidth
    physicalCanvas.width = width
    physicalCanvas.height = height
    parameterCanvas.width = width
    parameterCanvas.height = height
    drawSurfaces()
    drawMouseOnSurface()
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
    surfaces[currentSurfaceId].points[dragId.i][dragId.j] = getXY(ev, physicalCanvas)
    resize()
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

    if (surfaces.length == 0 || surfaces[currentSurfaceId].points.length == 0)
    {
      return
    }

    //Get closest point to the click
    var minimumDistance = width, distanceSquare, xDelta, yDelta
    for (var i = 0; i < surfaces[currentSurfaceId].points.length; i++)
    {
      for (var j = 0; j < surfaces[currentSurfaceId].points[0].length; j++)
      {
        distanceSquare = calcDistanceSquare(clickCoordinates, surfaces[currentSurfaceId].points[i][j]);
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
    surfaces[currentSurfaceId].points[dragId.i][dragId.j] = clickCoordinates
    resize()
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
    mouseOnSurface = getXY(ev, parameterCanvas)
    resize()
  }
  function toHex(number, size)
  {
      var s = number.toString(16);
      while (s.length < size) {s = "0" + s;}
      return s;
  }

  function drawSkeleton()
  {
    skeletonPoints = tensor(surfaces[currentSurfaceId], mouseOnSurface.y, mouseOnSurface.x)
    for (var k = 1; k < skeletonPoints.length; k++)
    {
      shade = Math.round((240) * k / (skeletonPoints.length - 2) + 10)
      lineColor = "#00" + toHex(shade, 2) + "00"
      for (var i = 0; i < skeletonPoints[k].length; i++)
      {
        drawPolygon(skeletonPoints[k][i], plotWidth, lineColor, "#000000")
      }
      for (var j = 0; j < skeletonPoints[k][0].length; j++)
      {
        drawPolygon(getColumn(skeletonPoints[k], j), plotWidth, lineColor, "#000000")
      }
    }
  }

  function drawMouseOnSurface()
  {
    if (surfaces.length == 0 || surfaces[currentSurfaceId].points.length == 0 || mouseOnSurface == -1)
    {
      return
    }

    drawParameterLine(mouseOnSurface.x, false, "#00f000")
    drawParameterLine(mouseOnSurface.y, true, "#00f000")

    if (shouldDrawSkeleton)
    {
      drawSkeleton()
    }
    else
    {
      //Draw curves
      plotCurveOnSurface(surfaces[currentSurfaceId], mouseOnSurface.x, false, "#00f000");
      plotCurveOnSurface(surfaces[currentSurfaceId], mouseOnSurface.y, true, "#00f000");
      //Draw dot
      point = tensor(surfaces[currentSurfaceId], mouseOnSurface.y, mouseOnSurface.x).pop()[0]
      console.log(point[0].x)
      drawPolygon(point, plotWidth, "#000000", "#000000")
    }


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
