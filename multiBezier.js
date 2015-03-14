function MultiBezier(curveCanvasId, scale, curvesList){
  var timer, deCasteljauRatio;
  var curveCanvas, polynomialsCanvas, curveCtx, polynomialsCtx, width, height, height1, plotWidth, doublePlotWidth,  dragId = -1;
  curveCanvas = document.getElementById(curveCanvasId);
  curveCtx = curveCanvas.getContext("2d");

  curveCanvas.addEventListener('mousemove', drag, false);
  curveCanvas.addEventListener('touchmove', drag, false);
  curveCanvas.addEventListener('mousedown', start_drag, false);
  curveCanvas.addEventListener('mouseup', stop_drag, false);
  curveCanvas.addEventListener('touchstart', start_drag, false);
  curveCanvas.addEventListener('touchend', stop_drag, false);
  window.addEventListener('keyup', onKeyUp, false);
  window.addEventListener('resize', resize, false);
  resize();

  function onKeyUp(ev)
  {
    switch(ev.keyCode)
    {
      //C
      case 67:
        drawDeCasteljau();
        break;
    }
  }

  function drawDeCasteljau()
  {
    deCasteljauRatio = 0;
    timer = window.setInterval(stepDeCasteljau, 40);
  }

  function stepDeCasteljau()
  {
    deCasteljauRatio += 0.005;
    drawCurve(deCasteljauRatio);
    //Stop
    if(deCasteljauRatio >= 1)
    {
      clearInterval(timer);
    }
  }

  //Draw lines and dots (polygon is open, last and first dots are not drawn)
  function drawPolygon(polygonPointsX, polygonPointsY, sizeOfPolygon, lineWidth, lineColor, dotColor)
  {
      curveCtx.lineWidth = lineWidth;
      curveCtx.beginPath();
      curveCtx.moveTo(polygonPointsX[0], height1 - polygonPointsY[0]);
      for (var i = 0; i < sizeOfPolygon; i++)
      {
        curveCtx.strokeStyle = dotColor;
        curveCtx.strokeRect(polygonPointsX[i] - plotWidth,
                            height1 - polygonPointsY[i] - plotWidth,
                            doublePlotWidth,
                            doublePlotWidth);
        curveCtx.stroke();
        curveCtx.strokeStyle = lineColor;
        curveCtx.lineTo(polygonPointsX[i], height1 - polygonPointsY[i]);
        curveCtx.stroke();
      }
  }

  function drawCurve(ratioToPlot)
  {
    var step = 1 / width;
    for (var curveId = 0; curveId < curvesList.length; curveId += 1)
    {
      var skeletonPointsX = new Float64Array(curvesList[curveId].numberOfPoints);
      var skeletonPointsY = new Float64Array(curvesList[curveId].numberOfPoints);
      var canvasSpacePointsX = new Float64Array(curvesList[curveId].numberOfPoints);
      var canvasSpacePointsY = new Float64Array(curvesList[curveId].numberOfPoints);
      curveCtx.clearRect(0,0, width, height);

      //Set x,y in canvas coordinates, plot control points
      for (var i = 0; i < numberOfPoints; i++)
      {
        canvasSpacePointsX[i] = curvesList[curveId].pointsX[i] * width;
        canvasSpacePointsY[i] = curvesList[curveId].pointsY[i] * height1;
      }

      //plot control polygon lines
      curveCtx.lineWidth = plotWidth;
      drawPolygon(canvasSpacePointsX, canvasSpacePointsY, numberOfPoints,"#0000f5", "#0000f0");

      //plot curve
      curveCtx.lineWidth = doublePlotWidth;
      var lastStepX = canvasSpacePointsX[0], lastStepY = height1 - canvasSpacePointsY[0];
      //Draw Curve step
      for (var t = step; t < 1; t += step)
      {
        curveStep = deCasteljau(canvasSpacePointsX, canvasSpacePointsY, t, false);
        curveCtx.strokeStyle = "#f00000";
        curveCtx.beginPath();
        curveCtx.moveTo(lastStepX, lastStepY);
        curveCtx.lineTo(curveStep[0], height1 - curveStep[1]);
        curveCtx.stroke();
        lastStepX = curveStep[0];
        lastStepY = height1 - curveStep[1];
      }
      //Draw skeleton
      if (ratioToPlot < 1)
      {
        deCasteljau(canvasSpacePointsX, canvasSpacePointsY, ratioToPlot, true);
      }
    }

  }

  function deCasteljau(canvasSpacePointsX, canvasSpacePointsY, t, shouldDraw)
  {
    var skeletonPointsX = new Float64Array(numberOfPoints)
    var skeletonPointsY = new Float64Array(numberOfPoints);
    skeletonPointsX.set(canvasSpacePointsX);
    skeletonPointsY.set(canvasSpacePointsY);
    for (var j = numberOfPoints - 1; j > 0; j--)
    {
      //Skeleton points in current iteration
      for (var i = 0; i < j; i++)
      {
        skeletonPointsX[i] = (1 - t) * skeletonPointsX[i] + t * skeletonPointsX[i + 1];
        skeletonPointsY[i] = (1 - t) * skeletonPointsY[i] + t * skeletonPointsY[i + 1];
      }
      if(shouldDraw)
      {
        curveCtx.font="30px Courier New";
        var roundT=(Math.round(t*100)/100);
        curveCtx.fillText("t=".concat(roundT), 30, 30);
        drawPolygon(skeletonPointsX, skeletonPointsY, j, plotWidth, "#00f000", "#0f0f0f");
      }
    }
    return [skeletonPointsX[0], skeletonPointsY[0]];
  }

  function resize()
  {
     height = width = Math.round(window.innerWidth * scale);
     height1 = height-1;
     plotWidth = Math.max(1, Math.round(width / 250));
     doublePlotWidth = 2 * plotWidth;
     curveCanvas.width = width;
     curveCanvas.height = height;
     polynomialsCanvas.width = width;
     polynomialsCanvas.height = height;
     drawBernsteinPolynomial();
     drawCurve(1);
  }

  function drag(ev)
  {
    //No point is chosen
    if (dragId < 0) return;
    var destCoordinates = getXY(ev);
    pointsX[dragId] = destCoordinates[0];
    pointsY[dragId] = destCoordinates[1];
    drawCurve(1);
    ev.preventDefault();
  }

  function start_drag(ev)
  {
    var clickCoordinates = getXY(ev);
    if (isNewPointMode)
    {
      addPoint(clickCoordinates[0], clickCoordinates[1]);
      return;
    }

    var minimumDistance = width, distanceSquare, xDelta, yDelta;
    //Get closest point to the click
    for (var i = 0; i < numberOfPoints; i++)
    {
      xDelta = (clickCoordinates[0] - pointsX[i]);
      yDelta = (clickCoordinates[1] - pointsY[i]);
      distanceSquare = xDelta * xDelta + yDelta * yDelta;
      if ( distanceSquare < minimumDistance )
      {
        dragId = i;
        minimumDistance = distanceSquare;
      }
    }
    pointsX[dragId] = clickCoordinates[0];  pointsY[dragId] = clickCoordinates[1];
    drawCurve(1);
    ev.preventDefault();
  }

  function stop_drag(ev)
  {
    dragId = -1;
    ev.preventDefault();
  }

  //Get x,y between 0 to 1 of given click event
  function getXY(ev)
  {
    if (!ev.clientX)
    {
      ev = ev.touches[0];
    }
    var rect = curveCanvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / width,
        y = (height1 - (ev.clientY - rect.top)) / height;
    return [x, y];
  }
} // end Bezier
