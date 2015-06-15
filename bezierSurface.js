$( document ).ready(function()
{
  var defaultSurfaces = [{"name":"1","points":[[{"x":0.14900511379241937,"y":0.20165},{"x":0.5810051137924194,"y":0.35645000000000004},{"x":0.9180056819915772,"y":0.1552272720336914}],[{"x":0.4676051137924194,"y":0.5058499999999999},{"x":0.6098051137924194,"y":0.49145},{"x":0.7736051137924195,"y":0.49685}],[{"x":0.22400568199157714,"y":0.8532272720336914},{"x":0.6116051137924194,"y":0.59225},{"x":0.9920056819915771,"y":0.8152272720336914}]]}]

  main(defaultSurfaces)

})

function main(inputSurfaces)
{
  var HISTORY_MAX_SIZE = 50
  var HIGH_RES_PIX_PER_SAMPLE  = 5
  var LOW_RES_PIX_PER_SAMPLE  = 30
  var BLACK_JACOBIAN_THRESHOLD = 0.003

  var currentlyDrawingJacobian = false
  var jacobianData = []
  var shouldDrawJacobian = true
  var lastDrawTimestamp = (new Date).getTime()
  var lastLowResDrawn = 0
  var history = [], forwardHistory = []
  var timer, deCasteljauCurveRatio = 1
  var surfaces
  var pointOnSurface = -1
  var mouseOnParameterSpace = -1
  var currentSurfaceId = 0
  var physicalCanvas, physicalCtx
  var parameterCanvas, parameterCtx
  var width, height, height1, plotWidth, doublePlotWidth,  dragId = -1
  var zoomDepth = 1
  init()
  redraw()

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
    $("#parameterCanvas").mouseleave(mouseLeave)
    $("#parameterCanvas").mouseup(mouseUpParameter)
    $("#physicalCanvas").mousemove(drag)
    $("#physicalCanvas").mousedown(startDrag)
    $("#physicalCanvas").mouseup(stopDrag)
    $("input:radio").change(redraw)
    //Mobile support
    $(document).keyup(onKeyUp)
    $("#radio10").prop("checked", true)
    pushToHistory()
  }

  function mouseLeave()
  {
    mouseOnParameterSpace = -1
    if (shouldDrawJacobian)
    {
      redrawJacobianData()
      return
    }
    redraw()
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
    redraw()
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
    redraw()
  }

  function pushToHistory()
  {
    //Deep copy
    var surfacesCopy = $.extend(true, [], surfaces)

    history.push(surfacesCopy)
    //Keep history size limited
    if (history.length > HISTORY_MAX_SIZE)
    {
      history.shift()
    }
    forwardHistory = []
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
    redraw()
  }

  //Load surfaces from file which is selected in "browse..." element
  function loadSurfaces(ev)
  {
    var file = $("#fileInput")[0].files[0]; // FileList object
    var reader = new FileReader()

    // Closure to capture the file information.
    reader.onload = function(e)
    {
      pushToHistory()
      surfaces = JSON.parse(reader.result)
      redraw()
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
      //+
      case 187:
      case 107:
        zoom(true)
        redraw()
        break
      //-
      case 189:
      case 109:
        zoom(false)
        redraw()
        break
      //S
      case 83:
        subDivideSurfaceByPoint()
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
        redraw()
        break
      //J
      case 74:
        shouldDrawJacobian = !shouldDrawJacobian
        redraw()
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
        redraw()
        break
    }
  }

  function subDivideSurfaceByPoint()
  {
    if (pointOnSurface == -1)
    {
      return
    }
    pushToHistory()
    surface = surfaces[currentSurfaceId]
    var newSurfaces = subDivideSurface(surface, pointOnSurface.x, pointOnSurface.y)
    surfaces.splice(currentSurfaceId, 1, newSurfaces[0], newSurfaces[1], newSurfaces[2], newSurfaces[3])

    updateSurfacesList()
    redraw()
  }


  //Add point as last in polygon, coordinates are between 0 to 1
  //If isNewCurve is true create a new curve and add the point to it.
  //Otherwise adds the point to the current curve.
  function addPoint(clickPoint, addRow)
  {
    //handle empty canvas
    if (surfaces.length == 0)
    {
      surfaces = [{
        name : "0",
        points : [[clickPoint]]
      }]
      currentSurfaceId = 0
      updateSurfacesList()
      redraw()
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
    redraw()
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
      //Column
      surfaces[currentSurfaceId].points.pop()
    }
    else
    {
      //Row
      for (var i = 0; i < surfaces[currentSurfaceId].points.length; i++)
      {
        surfaces[currentSurfaceId].points[i].pop()
      }
    }
    removeCurrentIfEmpty()
    redraw()
  }

  function removeCurrentIfEmpty()
  {
    //remove empty surfaces
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
      drawParameterLine(u / linesInGrid, true, "rgb(255, 0, 0)");
    }
    for (var v = 0; v <= linesInGrid; v += 1)
    {
      drawParameterLine(v / linesInGrid, false, "rgb(255, 0, 0)");
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
  function drawPolygon(polygonPoints, lineWidth, lineColor, dotColor, isCurrent, rowIndex)
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
      if (isCurrent && rowIndex != -1)
      {
        //Write Point id
        physicalCtx.fillStyle = "rgb(0, 0, 0)"
        physicalCtx.font="15px Courier New"
        pointString = "P(" + i.toString() + "," + rowIndex.toString() + ")"
        physicalCtx.fillText(pointString, width * polygonPoints[i].x + 10, height1 * ( 1- polygonPoints[i].y))
      }
    }
  }

  function findMinMaxJacobian(step)
  {
    min = Number.POSITIVE_INFINITY
    max = Number.NEGATIVE_INFINITY
    for (var u = 0; u < 1; u += step)
    {
      for (var v = 0; v < 1; v += step)
      {
        point = tensor(surfaces[currentSurfaceId], u, v).pop()[0][0]
        jacVal = getJacobian(surfaces[currentSurfaceId], u, v)
        if (jacVal < min)
        {
          min = jacVal
        }
        if (jacVal > max)
        {
          max = jacVal
        }
      }
    }
    /*
    Note (see note at getJacobian):
    We add epsilons here to avoid the black screen which is caused by a too narrow
    values range that occurs when all Jacobian values in the surface are the same.
    */
    return [min - Number.EPSILON, max + Number.EPSILON]
  }

  /*
  Performance Note:
  We did this weird row-by-row drawing, where every row drawing is an event handler
  to avoid freezing the canvas with a single and heavy event handler that calculates
  the Jacobian value of all pixel. JS multi-threading might make this even faster.
  */
  function drawJacobianRow(v, pixelsPerSample, movementTime, min, max)
  {
    step = pixelsPerSample / (2 * width)
    if(surfaces.length == 0)
    {
      currentlyDrawingJacobian = false
      return
    }
    if ((v >= 1) || (lastDrawTimestamp > movementTime))
    {
      if (v >= 1)
      {
        currentlyDrawingJacobian = false
      }
      return
    }
      jacobianData.push([])
      for (var u = 0; u < 1; u += step)
      {
      point = tensor(surfaces[currentSurfaceId], u, v).pop()[0][0]
      jacVal = getJacobian(surfaces[currentSurfaceId], u, v)

        /*
        Note:
        Here we set a range that will be colored black.
        This will give visual indication of the area where the Jacobian is "zero"
        */
        if (Math.abs(jacVal) < BLACK_JACOBIAN_THRESHOLD * (max - min))
        {
          color = "rgb(0, 0, 0)"
        }
        else
        {
          shade = (jacVal - min) / (max - min)
          /*
          Note:
          To determine an approximation of the Jacobian values range, we sampled the surface
          before drawing the values in higher resolution. Values that are drawn in between the
          samples might exceed the max\min that was sampled, so we round these exceeding values
          to fit in the approximated range. If the sampling resolution constant is high enough
          and the surface is not to extreme in its values, it shouldn't be visible.
          */
          if (shade > 1)
          {
            shade = 1
          }
          if ( shade < 0)
          {
            shade = 0
          }
          color = shadeToColor(shade)
        }
        jacobianData[jacobianData.length - 1].push(color)
        physicalCtx.fillStyle = color
        physicalCtx.fillRect(point.x * width, height1 * (1 - point.y), pixelsPerSample * zoomDepth, pixelsPerSample * zoomDepth)
        parameterCtx.fillStyle = color
        parameterCtx.fillRect(u * width, height1 * (1 - v), pixelsPerSample, pixelsPerSample)
    }
    setTimeout(function(){drawJacobianRow(v + step, pixelsPerSample, movementTime, min, max)})
  }

  function drawJacobian()
  {
    if(surfaces.length == 0)
    {
      return
    }
    if (shouldDrawJacobian &&
        surfaces[currentSurfaceId].points.length > 1 &&
        surfaces[currentSurfaceId].points[0].length)
    {
      minMax = findMinMaxJacobian(LOW_RES_PIX_PER_SAMPLE.toFixed(2) / width)
      min = minMax[0]
      max = minMax[1]
      jacobianData = []
      currentlyDrawingJacobian = true
      drawJacobianRow(0, HIGH_RES_PIX_PER_SAMPLE, lastDrawTimestamp, min, max)
    }
  }

  function drawSurfaces()
  {
    if (surfaces.length == 0)
    {
      return
    }
    for (var i = 0; i < surfaces.length; i++)
    {
      drawSurface(surfaces[i], i == currentSurfaceId)
    }
    if (pointOnSurface == -1)
    {
      return
    }
    //Draw point on surface
    drawParameterLine(pointOnSurface.x, false, "rgb(255, 0, 255)")
    drawParameterLine(pointOnSurface.y, true, "rgb(255, 0, 255)")
    plotCurveOnSurface(surfaces[currentSurfaceId], pointOnSurface.x, true, "rgb(255, 0, 255)");
    plotCurveOnSurface(surfaces[currentSurfaceId], pointOnSurface.y, false, "rgb(255, 0, 255)");
  }

  function drawSurfaceControls(surface, lineColor, dotColor, isCurrent)
  {

    for (var i = 0; i < surface.points[0].length; i++)
    {
      drawPolygon(getColumn(surface.points, i), doublePlotWidth, lineColor, dotColor, isCurrent, -1)
    }
    for (var i = 0; i < surface.points.length; i++)
    {
      rowIndex = -1
      if (!shouldDrawJacobian)
      {
        rowIndex = i
      }
      drawPolygon(surface.points[i], doublePlotWidth, lineColor, dotColor, isCurrent, rowIndex)
    }
  }

  function drawSurface(surface, isCurrent)
  {

    if (surface.points.length == 0 || surface.points[0].length == 0)
    {
      return
    }
    //disabled colors
    var lineColor = "rgb(200, 200, 200)"
    var dotColor = "rgb(100, 100, 100)"
    if (isCurrent)
    {
      //enabled colors
      lineColor = "rgb(0, 0, 230)"
      dotColor = "rgb(0, 0, 200)"
    }

    drawSurfaceControls(surface, lineColor, dotColor, isCurrent)
    //plot curve
    var curveColor = "rgb(255, 20, 20)"
    if (isCurrent)
    {
      curveColor = "rgb(255, 0, 0)"
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

  function removeRowAndColumn(surface, rowIndex, columnIndex)
  {
    newSurface = jQuery.extend(true, {}, surface)
    newSurface.points.splice(rowIndex, 1)
    for (var i = 0; i < newSurface.points.length; i++)
    {
      newSurface.points[i].splice(columnIndex , 1)
    }
    return newSurface
  }

  function zoom(zoomIn)
  {
    var surfacesCopy = $.extend(true, [], surfaces)
    factor = 0.9
    if (zoomIn)
    {
      factor = 1.1
    }
    zoomDepth *= factor
    for (var k = 0; k < surfacesCopy.length; k++)
    {
      for (var i = 0; i < surfacesCopy[k].points.length; i++)
      {
        for (var j = 0; j < surfacesCopy[k].points[i].length; j++)
        {

          surfacesCopy[k].points[i][j].x -= .5
          surfacesCopy[k].points[i][j].x *= factor
          surfacesCopy[k].points[i][j].x += .5
          surfacesCopy[k].points[i][j].y -= .5
          surfacesCopy[k].points[i][j].y *= factor
          surfacesCopy[k].points[i][j].y += .5
        }
      }
    }
    surfaces = surfacesCopy
  }

  function writeStatus(physicalMouseCoordinates)
  {
    writeStatusParameter(physicalMouseCoordinates)
    writeStatusPhysical(physicalMouseCoordinates)
  }
  function writeStatusPhysical(physicalMouseCoordinates)
  {
    var deCasteljauCurveStatus = "Off"
    var jacobianStatus = "Off"
    if (shouldDrawJacobian)
    {
      jacobianStatus = "On"
    }
    if (shouldDrawSkeleton)
    {
      deCasteljauCurveStatus = "On"
    }
    //White background
    physicalCtx.fillStyle="rgba(255, 255, 255, 0.9)"
    physicalCtx.fillRect(0,1,200,70);
    //text
    physicalCtx.fillStyle="rgb(0, 0, 0)"
    physicalCtx.font="15px Courier New"
    physicalCtx.fillText("[+/-] Zoom", 5, 20)
    physicalCtx.fillText("[j] Jacobian: " + jacobianStatus, 5, 35)
    physicalCtx.fillText("[c] De-Casteljau: " + deCasteljauCurveStatus, 5, 50)

  }

  function writeStatusParameter(physicalMouseCoordinates)
  {

    if (mouseOnParameterSpace == -1)
    {
      return
    }
    //white background
    parameterCtx.fillStyle="rgba(255, 255, 255, 0.9)"
    parameterCtx.fillRect(0,1,200,70);
    //text
    parameterCtx.fillStyle="rgb(0, 0, 0)"
    parameterCtx.font="bold 15px Courier New"
    parameterCtx.fillText("Param: (" + mouseOnParameterSpace.x.toFixed(2) + ", " + mouseOnParameterSpace.y.toFixed(2) +")", 5, 20)
    parameterCtx.fillText("Physi: (" + physicalMouseCoordinates.x.toFixed(2) + ", " + physicalMouseCoordinates.y.toFixed(2) +")", 5, 35)

    jacVal = getJacobian(surfaces[currentSurfaceId], mouseOnParameterSpace.x, mouseOnParameterSpace.y)
    parameterCtx.fillText("Jacobian: " + jacVal.toFixed(3), 5, 50)
  }

  function redraw()
  {
    lastDrawTimestamp = (new Date).getTime()
    physicalCtx.clearRect(0,0, width, height)
    parameterCtx.clearRect(0,0, width, height)
    height = physicalCtx.canvas.height
    width = physicalCtx.canvas.width
    height1 = height-1
    plotWidth = Math.max(1, Math.round(width / 250))
    doublePlotWidth = 2 * plotWidth
    physicalCanvas.width = width
    physicalCanvas.height = height
    parameterCanvas.width = width
    parameterCanvas.height = height
    drawJacobian()
    drawSurfaces()
    physicalMouseCoordinates = drawMouseOnParameterSpace()
    drawParameterGrid()
    writeStatus(physicalMouseCoordinates)
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
    redraw()
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
    redraw()
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
    redraw()
  }

  function mouseMoveParameter(ev)
  {
    mouseOnParameterSpace = getXY(ev, parameterCanvas)
    if(!shouldDrawJacobian)
    {
      redraw()
      return
    }
    if(currentlyDrawingJacobian)
    {
      return
    }
    redrawJacobianData()
    writeStatusParameter(tensor(surfaces[currentSurfaceId], mouseOnParameterSpace.x, mouseOnParameterSpace.y).pop()[0][0])
  }


  function redrawJacobianData()
  {

    if((!shouldDrawJacobian) || currentlyDrawingJacobian)
    {
      return
    }
    for (var row = 0; row < jacobianData.length; row++)
    {
      for (var column = 0; column < jacobianData[0].length; column++)
      {
        parameterCtx.fillStyle = jacobianData[row][column]
        parameterCtx.fillRect(column * HIGH_RES_PIX_PER_SAMPLE / 2 , height1 - row * HIGH_RES_PIX_PER_SAMPLE / 2, HIGH_RES_PIX_PER_SAMPLE, HIGH_RES_PIX_PER_SAMPLE)
      }
    }
  }

  /*
  Calculates and draw the DeCasteljau skeleton of given surface at given u,v coordinates
  For nicer visualization, color the steps in the skeleton with different shades of green.
  */
  function drawSkeleton(surface, u, v)
  {
    skeletonPoints = tensor(surface, u, v)
    for (var k = 1; k < skeletonPoints.length; k++)
    {
      //Different shades of green
      shade = Math.round((240) * k / (skeletonPoints.length - 2) + 10)
      lineColor = "rgb(0, " + shade.toString() + ", 0)"
      //Draw rows on mesh
      for (var i = 0; i < skeletonPoints[k].length; i++)
      {
        drawPolygon(skeletonPoints[k][i], plotWidth, lineColor, "rgb(0, 0, 0)", false, -1)
      }
      //Draw columns on mesh
      for (var j = 0; j < skeletonPoints[k][0].length; j++)
      {
        drawPolygon(getColumn(skeletonPoints[k], j), plotWidth, lineColor, "rgb(0, 0, 0)", false, -1)
      }
    }
    return skeletonPoints.pop()[0][0]
  }

  /*
  Draw the physical DeCasteljau skeleton of green cross when mouse is over the parameter canvas
  */
  function drawMouseOnParameterSpace()
  {
    if (surfaces.length == 0 || surfaces[currentSurfaceId].points.length == 0 || mouseOnParameterSpace == -1)
    {
      return
    }

    //lines over mouse position, parameter space
    drawParameterLine(mouseOnParameterSpace.x, false, "rgb(0, 255, 0)")
    drawParameterLine(mouseOnParameterSpace.y, true, "rgb(0, 255, 0)")

    if (shouldDrawSkeleton)
    {
      physicalMouseCoordinates = drawSkeleton(surfaces[currentSurfaceId],
                                              mouseOnParameterSpace.x,
                                              mouseOnParameterSpace.y)
    }
    else
    {
      //Draw curves
      plotCurveOnSurface(surfaces[currentSurfaceId], mouseOnParameterSpace.x, true, "rgb(0, 255, 0)");
      plotCurveOnSurface(surfaces[currentSurfaceId], mouseOnParameterSpace.y, false, "rgb(0, 255, 0)");
      //Draw dot
      physicalMouseCoordinates = tensor(surfaces[currentSurfaceId], mouseOnParameterSpace.x, mouseOnParameterSpace.y).pop()[0][0]
      drawPolygon([physicalMouseCoordinates], plotWidth, "rgb(0, 0, 0)", "rgb(0, 0, 0)", false, -1)
    }
    return physicalMouseCoordinates
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

  // takes value between 0 to 1 and returns an rgb which
  // represent the color on the visible spectrum at value
  function shadeToColor(value)
  {

    wl = Math.round(((780 - 380) * value) + 380)

    if (wl >= 380 && wl < 440)
    {
        R = -1 * (wl - 440) / (440 - 380);
        G = 0;
        B = 1;
    } else if (wl >= 440 && wl < 490) {
       R = 0;
       G = (wl - 440) / (490 - 440);
       B = 1;
    } else if (wl >= 490 && wl < 510) {
        R = 0;
        G = 1;
        B = -1 * (wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
        R = (wl - 510) / (580 - 510);
        G = 1;
        B = 0;
    } else if (wl >= 580 && wl < 645) {
        R = 1;
        G = -1 * (wl - 645) / (645 - 580);
        B = 0.0;
    } else if (wl >= 645 && wl <= 780) {
        R = 1;
        G = 0;
        B = 0;
    } else {
        R = 0;
        G = 0;
        B = 0;
    }
    return "rgb(" + (R * 100) + "%," + (G * 100) + "%," + (B * 100) + "%)";
  }






//MATHEMATICAL FUNCTIONS


  //Receive points of control polygon and the t parameter of the Bezier curve function
  //Return array of arrays of the DeCasteljau points by order:
  //0 - the control points (n points)
  //1 - first level of the skeleton points (n-1 points)
  //...
  //n-1 - the curve point (1 point)
  function deCasteljauCurve(points, t)
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


  /*
  Using the DeCasteljau algorithm to build the skeleton of given surface
  at given (u,v) point.
  The skeleton returned is an array of matrices, where each matrix represents
  a step of DeCastlejau algorithm. The last matrix in the array will contain a
  single point which is the physical value of the surface at the u,v coordinates.
  When the surface is not NxN, we will end up with a curve and not a single point,
  then we will use the DeCasteljau curve algorithm, and concatenate its skeleton to the tensor one.
  */
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
                skeletonPoints[k][i + 1][j].x * v * (1 - u) +
                skeletonPoints[k][i][j + 1].x * (1 - v) * u +
                skeletonPoints[k][i + 1][j + 1].x * v * u,
            y : skeletonPoints[k][i][j].y * (1 - u) * (1 - v)+
                skeletonPoints[k][i + 1][j].y * v * (1 - u) +
                skeletonPoints[k][i][j + 1].y * (1 - v) * u +
                skeletonPoints[k][i + 1][j + 1].y * v * u
          })
        }
        nextStepSkeleton.push(nextStepSkeletonRow)
      }
      skeletonPoints.push(nextStepSkeleton)
    }
    //When the surface is not NxN:
    //Last decasteljau steps, now it's a curve - not a surface
    //If more rows than columns in given points matrix
    if (skeletonPoints[skeletonPoints.length - 1].length > 1)
    {
      var skeletonCurve = deCasteljauCurve(getColumn(skeletonPoints.pop(), 0), v)
      for (var i = 0; i < skeletonCurve.length; i++)
      {
        skeletonPoints.push([skeletonCurve[i]])
      }
      return skeletonPoints
    }
    //If more columns than rows in given points matrix
    if (skeletonPoints[skeletonPoints.length - 1][0].length > 1)
    {
      var skeletonCurve = deCasteljauCurve(skeletonPoints.pop()[0], u)
      for (var i = 0; i < skeletonCurve.length; i++)
      {
        skeletonPoints.push([skeletonCurve[i]])
      }
      return skeletonPoints
    }
    //If given matrix was square
    return skeletonPoints
  }

  /*
  Returns array of 4 points which between them creates a
  plane (patch) which is tangent to the surface on given u,v coordinates.
  Uses method described in "Point and tangent computation" (Thomas W. Sederberg, 1995)
  When the surface is NxN, will return the one-before-last step of the DeCasteljau tensor
  algorithm which contains 2X2 points.
  When the surface is not NxN, we use the points from tensor skeleton before they become a curve.
  This will be an 2xM strip, from which we calculate 4 curves of points received when
  deleting the last / first column and row of the 2xM strip (first-first, first-last, etc).
  The points of the curves at the u / v (depending if its 2xM or Mx2) will be the tangent patch.
  */
  function getTangentPatch(surface, u, v)
  {
    var p00, p01, p10, p11
    rows = surface.points.length
    columns = surface.points[0].length
    if (rows == columns)
    {
      skeleton = tensor(surface, u, v)
      bilinearPatch = skeleton[skeleton.length - 2]
      p00 = bilinearPatch[0][0]
      p10 = bilinearPatch[1][0]
      p01 = bilinearPatch[0][1]
      p11 = bilinearPatch[1][1]

    }
    else if (rows > columns)
    {
      skeleton = tensor(surface, u, v)
      strip = skeleton[columns - 2]
      points00 = getColumn(strip, 0)
      points10 = getColumn(strip, 0)
      points01 = getColumn(strip, 1)
      points11 = getColumn(strip, 1)
      points00.splice(points00.length - 1, 1)
      points01.splice(points01.length - 1, 1)
      points10.splice(0, 1)
      points11.splice(0, 1)

      p00 = deCasteljauCurve(points00, u).pop()[0]
      p01 = deCasteljauCurve(points01, u).pop()[0]
      p10 = deCasteljauCurve(points10, u).pop()[0]
      p11 = deCasteljauCurve(points11, u).pop()[0]
    }
    else
    {
      skeleton = tensor(surface, u, v)
      strip = skeleton[rows - 2]
      points00 = $.extend(true, [], strip[0])
      points01 = $.extend(true, [], strip[0])
      points10 = $.extend(true, [], strip[1])
      points11 = $.extend(true, [], strip[1])
      points00.splice(points01.length - 1, 1)
      points01.splice(0, 1)
      points10.splice(points11.length - 1, 1)
      points11.splice(0, 1)
      p00 = deCasteljauCurve(points00, v).pop()[0]
      p01 = deCasteljauCurve(points01, v).pop()[0]
      p10 = deCasteljauCurve(points10, v).pop()[0]
      p11 = deCasteljauCurve(points11, v).pop()[0]
    }
    return [p00, p01, p10, p11]
  }


  //Calculates the determinant of the Jacobian matrix of given
  //surface at given coordinates
  //To calculate the derivative we first get the 2X2 patch that is tangent to
  //the surface, using getTangentPatch function.
  function getJacobian(surface, u, v)
  {
    if (surface.points.length < 2 || surface.points[0].length < 2)
    {
        //This is a curve, not a surface
        return
    }
    bilinearPatch = getTangentPatch(surface, u, v)
    p00 = bilinearPatch[0]
    p01 = bilinearPatch[1]
    p10 = bilinearPatch[2]
    p11 = bilinearPatch[3]
    /*
    10 -------- 11
    |           |
    |1-v        |1-v
    |    df/du  |
    |---------->|
    |           |
    |v          |v
    |           |
    00 -------- 01

    10 -------- 11
    |  u /\  1-u |
    |    |       |
    |    |df/dv  |
    |    |       |
    |    |       |
    |    |       |
    |  u |  1-u  |
    00 -------- 01
    */
    dxdu = ((1 - v) * (p00.x - p01.x) + v * (p10.x - p11.x)) * surface.points.length
    dydu = ((1 - v) * (p00.y - p01.y) + v * (p10.y - p11.y)) * surface.points.length
    dxdv = ((1 - u) * (p00.x - p10.x) + u * (p01.x - p11.x)) * surface.points[0].length
    dydv = ((1 - u) * (p00.y - p10.y) + u * (p01.y - p11.y)) * surface.points[0].length

    jacobianDeterminant = (dxdu * dydv) - (dydu * dxdv)
    /*
    Note:
    We trim the float precision to avoid noise caused by the imprecise nature of
    float arithmetic. It is very visible when presenting an square grid mesh that
    should have a constant Jacobian in every point on it.
    */
    return parseFloat(jacobianDeterminant.toFixed(8))
  }

  //Divides given surface into 4 different surfaces that together have the same shape
  //Adds their index from 1 to 4 to the new sub-surfaces name
  //Uses the splitCurve function.
  function subDivideSurface(surface, u, v)
  {
    //Divide on u axis
    var semiSurfaces = [[], []]
    for (var i = 0; i < surface.points.length; i++)
    {
      //split all rows
      var subCurves = splitCurve(surface.points[i], v)
      semiSurfaces[0].push(subCurves[0])
      semiSurfaces[1].push(subCurves[1])
    }
    var quadSurfaces = [
      {
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
      }
    ]

    //divide on u axis
    for (var j = 0; j < 2; j++)
    {
      for (var i = 0; i < semiSurfaces[0][0].length; i++)
      {
        var subCurves = splitCurve(getColumn(semiSurfaces[j], i), u)
        quadSurfaces[2 * j].points.push(subCurves[0])
        quadSurfaces[2 * j + 1].points.push(subCurves[1])
      }
    }
    for (var i = 0; i < quadSurfaces.length; i++)
    {
      quadSurfaces[i] = transposeSurface(quadSurfaces[i])
    }
    return quadSurfaces
  }

  // Return two curves that has the same shape of the given curve.
  // The meeting point of the two new curves is the point t on the original curve.
  // Uses DeCasteljau algorithm
  function splitCurve(curve, t)
  {
    var skeletonPoints = deCasteljauCurve(curve, t)
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

  //Return an array of points at given index from
  //2d points array of given surface
  function getColumn(matrix, index)
  {
    column = []
    for (var i = 0; i < matrix.length; i++)
    {
      column.push(matrix[i][index])
    }
    return column
  }

  //Transpose the 2d array of points representing the given surface
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
}
