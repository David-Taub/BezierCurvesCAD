function Bezier(curveCanvasId, polynomialsCanvasId, scale, ptX, ptY){

  var curveCanvas, polynomialsCanvas, curveCtx, polynomialsCtx, width, height, height1, plotWidth, doublePlotWidth,  dragId = -1;
  var isNewPointMode = false;
  var numberOfPoints = ptX.length;
  var iColor = ["#f00000","#00f000","#0000f0","#00f0f0","#f0f000","#f000f0","#090909"];
  var pointsX = new Float64Array(ptX),
      pointsY = new Float64Array(ptY);
  curveCanvas = document.getElementById(curveCanvasId);
  curveCtx = curveCanvas.getContext("2d");
  polynomialsCanvas = document.getElementById(polynomialsCanvasId);
  polynomialsCtx = polynomialsCanvas.getContext("2d");
  curveCanvas.addEventListener('mousemove', drag, false);
  curveCanvas.addEventListener('touchmove', drag, false);
  curveCanvas.addEventListener('mousedown', start_drag, false);
  curveCanvas.addEventListener('mouseup', stop_drag, false);
  curveCanvas.addEventListener('touchstart', start_drag, false);
  curveCanvas.addEventListener('touchend', stop_drag, false);
  window.addEventListener('keydown', onKeyDown, false);
  window.addEventListener('keyup', onKeyUp, false);
  window.addEventListener('resize', resize, false);
  resize();

  function onKeyDown(ev)
  {
    if (ev.ctrlKey)
    {
      isNewPointMode = true;
    }
  }
  function onKeyUp(ev)
  {
    isNewPointMode = false;
  }

  function addPoint(x, y)
  {
    numberOfPoints += 1;
    var newPointsX = new Float64Array(numberOfPoints);
    var newPointsY = new Float64Array(numberOfPoints);
    newPointsX.set(pointsX);
    newPointsY.set(pointsY);
    newPointsX[pointsX.length] = x;
    newPointsY[pointsY.length] = y;
    pointsX = newPointsX;
    pointsY = newPointsY;
    resize();
  }

  function drawBernsteinPolynomial()
  {
    //Setup
    var step = doublePlotWidth / (width - doublePlotWidth), t = step;
    var lastStepValues = new Float64Array(numberOfPoints + 1);
    var currentStepValues = new Float64Array(numberOfPoints + 1);
    currentStepValues[1] = height1;
    polynomialsCtx.clearRect(0,0, width, height);
    polynomialsCtx.lineWidth = plotWidth;
    //Each pixel on the X axis
    for (var k = doublePlotWidth; k < width; k += doublePlotWidth)
    {
      lastStepValues.set(currentStepValues);
      //Clean current step
      currentStepValues = new Float64Array(numberOfPoints + 1);
      currentStepValues[1] = height1;
      //Calc current pixel location - Bernstein polynomials
      for (var j = 1; j < numberOfPoints; j++)
      {
        for (var i = j+1; i > 0; i--)
        {
          currentStepValues[i] = (1-t) * currentStepValues[i] + t * currentStepValues[i-1];
        }
      }
      //Plot
      for (var poliynomialId = 1; poliynomialId < numberOfPoints + 1; poliynomialId++)
      {
        polynomialsCtx.strokeStyle = iColor[(poliynomialId - 1) % 7];
        polynomialsCtx.beginPath();
        polynomialsCtx.moveTo(k - doublePlotWidth, height1 - lastStepValues[poliynomialId]);
        polynomialsCtx.lineTo(k, height1 - currentStepValues[poliynomialId]);
        polynomialsCtx.stroke();
      }
      t += step;
    }
  }

  function drawCurve()
  {
    var step = 1 / width, t = step;
    var skeletonPointsX = new Float64Array(numberOfPoints), skeletonPointsY = new Float64Array(numberOfPoints);
    var canvasSpacePointsX = new Float64Array(numberOfPoints), canvasSpacePointsY = new Float64Array(numberOfPoints);
    var X,Y;
    curveCtx.clearRect(0,0, width, height);
    curveCtx.lineWidth = plotWidth;
    //TODO: Magic
    curveCtx.strokeStyle = "#0000f0";

    //Set x,y in canvas coordinates, plot control points
    for (var i = 0; i < numberOfPoints; i++)
    {
      X = canvasSpacePointsX[i] = pointsX[i] * width;
      Y = canvasSpacePointsY[i] = pointsY[i] * height1;
      curveCtx.strokeRect(X - plotWidth, height1 - Y - plotWidth, doublePlotWidth, doublePlotWidth);
    }

    //plot control polygon lines
    if ( numberOfPoints > 2 )
    {
      curveCtx.beginPath();  curveCtx.moveTo(canvasSpacePointsX[0], height1 - canvasSpacePointsY[0]);
      for (var i = 1; i < numberOfPoints; i++)
      {
        curveCtx.lineTo(canvasSpacePointsX[i], height1 - canvasSpacePointsY[i]);
      }
      curveCtx.stroke();
    }

    //plot curve
    curveCtx.lineWidth = doublePlotWidth;
    //TODO: magic
    curveCtx.strokeStyle = "#f00000";
    curveCtx.beginPath();
    curveCtx.moveTo(canvasSpacePointsX[0], height1 - canvasSpacePointsY[0]);

    for (var k = 1; k < width; k++)
    {
      //De Castlejau algorithm
      skeletonPointsX.set(canvasSpacePointsX);
      skeletonPointsY.set(canvasSpacePointsY);
      //De Castlejau iterations
      for (var j = numberOfPoints - 1; j > 0; j--)
      {
        //Skeleton points in current iteration
        for (var i = 0; i < j; i++)
        {
          skeletonPointsX[i] = (1 - t) * skeletonPointsX[i] + t * skeletonPointsX[i + 1];
          skeletonPointsY[i] = (1 - t) * skeletonPointsY[i] + t * skeletonPointsY[i + 1];
        }
      }
      curveCtx.lineTo(skeletonPointsX[0], height1 - skeletonPointsY[0]);
      t += step;
    }
    curveCtx.stroke();
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
     drawCurve();
  }
  function drag(ev)
  {
    //No point is chosen
    if (dragId < 0) return;
    var destCoordinates = getXY(ev);
    pointsX[dragId] = destCoordinates[0];
    pointsY[dragId] = destCoordinates[1];
    drawCurve();
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
    drawCurve();
    ev.preventDefault();
  }

  function stop_drag(ev)
  {
    dragId = -1;
    ev.preventDefault();
  }

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
