$( document ).ready(function()
{
    var b1 = new main( .3, [ .1, .9, .9, .5], [.1, .9, .1, .1]);

});

function download(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }
}
function main(scale, ptX, ptY)
{
  var currentCurveId = 0;
  var timer, deCasteljauRatio;
  var curves;
  var curveCanvas, polynomialsCanvas, curveCtx, polynomialsCtx, width, height, height1, plotWidth, doublePlotWidth,  dragId = -1;
  var iColor = ["#f00000","#00f000","#0000f0","#00f0f0","#f0f000","#f000f0","#090909"];
  init();
  resize();

  function init()
  {
    var curve = {
      numberOfPoints : ptX.length,
      pointsX : new Float64Array(ptX),
      pointsY : new Float64Array(ptY),
      startT : 0,
      endT : .5
    };
    curves = [curve];
    curveCanvas = $("#bezierCanvas").get(0);
    curveCtx = curveCanvas.getContext("2d");
    polynomialsCanvas = $("#bernsteinCanvas").get(0);
    polynomialsCtx = polynomialsCanvas.getContext("2d");

    $("#bezierCanvas").mousemove(drag);
    $("#bezierCanvas").mousedown(startDrag);
    $("#bezierCanvas").mouseup(stopDrag);
    $('#slider').on("change mousemove", function()
    {
      deCasteljauRatio = this.value/this.max;
      drawCurves()
    });

    //Mobile support

    $("#bezierCanvas").bind('touchmove', drag);
    $("#bezierCanvas").bind('touchstart', startDrag);
    $("#bezierCanvas").bind('touchend', stopDrag);
    $(document).keyup(onKeyUp);
    $(document).resize(resize);
  }
  // function saveCurve()
  // {
  //   var viewModel = {
  //   number : ko.observable("Bert"),
  //   lastName : ko.observable("Smith"),
  //   pets : ko.observableArray(["Cat", "Dog", "Fish"]),
  //   type : "Customer"
  //   };

  // }
  function onKeyUp(ev)
  {
    switch(ev.keyCode)
    {
      //DELETE
      case 46:
        deletePoint();
        break;
      //C
      case 67:
        drawDeCasteljau();
        break;
    }
  }

  function drawDeCasteljau()
  {
    deCasteljauRatio = 0;
    timer = window.setInterval(stepDeCasteljau, 5);
  }

  function stepDeCasteljau()
  {
    deCasteljauRatio += 0.001;
    $("#slider").val(deCasteljauRatio * $("#slider").prop('max'));
    drawCurves();
    //Stop
    if(deCasteljauRatio >= 1)
    {
      clearInterval(timer);
    }
  }

  //Add point as last in polygon, coordinates are between 0 to 1
  //e.g. addPoint(0.3, 0.5)
  function addPoint(x, y)
  {
    curves[currentCurveId].numberOfPoints += 1;
    var newPointsX = new Float64Array(numberOfPoints);
    var newPointsY = new Float64Array(numberOfPoints);
    //copy old array to new
    for (var i = 0; i < curves[currentCurveId].numberOfPoints; i += 1)
    {
      newPointsX[i] = pointsX[i];
      newPointsY[i] = pointsY[i];
    }
    newPointsX[numberOfPoints - 1] = x;
    newPointsY[numberOfPoints - 1] = y;
    curves[currentCurveId].pointsX = newPointsX;
    curves[currentCurveId].pointsY = newPointsY;
    resize();
  }

  //Delete last point in polygon
  function deletePoint()
  {
    curves[currentCurveId].numberOfPoints -= 1;
    resize();
  }

  function drawBernsteinPolynomial()
  {
    //Setup
    var step = doublePlotWidth / (width - doublePlotWidth), t = step;
    var lastStepValues = new Float64Array(curves[currentCurveId].numberOfPoints + 1);
    var currentStepValues = new Float64Array(curves[currentCurveId].numberOfPoints + 1);
    currentStepValues[1] = height1;
    polynomialsCtx.clearRect(0,0, width, height);
    polynomialsCtx.lineWidth = plotWidth;
    //Each pixel on the X axis
    for (var k = doublePlotWidth; k < width; k += doublePlotWidth)
    {
      lastStepValues.set(currentStepValues);
      //Clean current step
      currentStepValues = new Float64Array(curves[currentCurveId].numberOfPoints + 1);
      currentStepValues[1] = height1;
      //Calc current pixel location - Bernstein polynomials
      for (var j = 1; j < curves[currentCurveId].numberOfPoints; j++)
      {
        for (var i = j+1; i > 0; i--)
        {
          currentStepValues[i] = (1 - t) * currentStepValues[i] + t * currentStepValues[i-1];
        }
      }
      //Plot
      for (var poliynomialId = 1; poliynomialId < curves[currentCurveId].numberOfPoints + 1; poliynomialId++)
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

  function drawCurves()
  {
    curveCtx.clearRect(0,0, width, height);
    for (var i = 0; i < curves.length; i++)
    {
      drawCurve(curves[i]);
    }
  }

  function drawCurve(curve)
  {
    var step = 1 / width;
    var skeletonPointsX = new Float64Array(curve.numberOfPoints);
    var skeletonPointsY = new Float64Array(curve.numberOfPoints);
    var canvasSpacePointsX = new Float64Array(curve.numberOfPoints);
    var canvasSpacePointsY = new Float64Array(curve.numberOfPoints);

    //Set x,y in canvas coordinates, plot control points
    for (var i = 0; i < curve.numberOfPoints; i++)
    {
      canvasSpacePointsX[i] = curve.pointsX[i] * width;
      canvasSpacePointsY[i] = curve.pointsY[i] * height1;
    }

    //plot control polygon lines
    curveCtx.lineWidth = plotWidth;
    drawPolygon(canvasSpacePointsX, canvasSpacePointsY, curve.numberOfPoints, "#0000f5", "#0000f0");

    //plot curve
    curveCtx.lineWidth = doublePlotWidth;
    var lastStepX = canvasSpacePointsX[0], lastStepY = height1 - canvasSpacePointsY[0];
    //Draw Curve step
    for (var t = curve.startT; t < curve.endT; t += step)
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
    if (deCasteljauRatio > curve.startT && deCasteljauRatio < curve.endT)
    {
      deCasteljau(canvasSpacePointsX, canvasSpacePointsY, deCasteljauRatio, true);
    }
  }

  function deCasteljau(canvasSpacePointsX, canvasSpacePointsY, t, shouldDraw)
  {
    var numberOfPoints = canvasSpacePointsX.length;
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
     drawCurves();
  }

  function drag(ev)
  {
    //No point is chosen
    if (dragId < 0) return;
    var destCoordinates = getXY(ev);
    pointsX[dragId] = destCoordinates[0];
    pointsY[dragId] = destCoordinates[1];
    drawCurves();
    ev.preventDefault();
  }

  function startDrag(ev)
  {
    var clickCoordinates = getXY(ev);
    if (ev.ctrlKey)
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
    drawCurves();
    ev.preventDefault();
  }

  function stopDrag(ev)
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
