$( document ).ready(function()
{
    var b1 = new main( .3, [ .1, .9, .9, .5], [.1, .9, .1, .1]);

});


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
      points : [],
      startT : 0,
      endT : .5
    };
    for (var i = 0; i < ptX.length; i++)
    {
      curve.points[i] = {
        x : ptX[i],
        y : ptY[i]
      };
    }
    curves = [curve];
    updateCurvesList();
    curveCanvas = $("#bezierCanvas").get(0);
    curveCtx = curveCanvas.getContext("2d");
    polynomialsCanvas = $("#bernsteinCanvas").get(0);
    polynomialsCtx = polynomialsCanvas.getContext("2d");
    $("#fileInput").change(loadCurves);
    $("#downloadButton").click(saveCurves);
    $("#curvesList").change(changeCurrentCurve);
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

  function updateCurvesList()
  {
    $('#curvesList').empty();
    for (var i=1; i <= curves.length; i++)
    {
      if (i==1)
      {
        $("#curvesList").append($("<option selected/>").text(i));
      }
      else
      {
        $("#curvesList").append($("<option />").text(i));
      }

    }
  }

  function changeCurrentCurve()
  {
    currentCurveId = $("#curvesList")[0].selectedIndex;
    resize();
  }

  function loadCurves(ev) {
    var file = $("#fileInput")[0].files[0]; // FileList object
    var reader = new FileReader();

    // Closure to capture the file information.
    reader.onload = function(e)
    {
      curves = JSON.parse(reader.result);
      updateCurvesList()
      resize();
    }

    // Read in the image file as a data URL.
    reader.readAsText(file);
  }



  function saveCurves()
  {
    download("curve.json", JSON.stringify(curves));
  }

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
  function splitCurve(curve, t)
  {

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
  function addPoint(newPoint)
  {
    curves[currentCurveId].points.push(newPoint);
    resize();
  }

  //Delete last point in polygon
  function deletePoint()
  {
    curves[currentCurveId].points.pop();
    resize();
  }

  function drawBernsteinPolynomial()
  {
    //Setup
    var step = doublePlotWidth / (width - doublePlotWidth)
    var t = step;
    var lastStepValues = new Float64Array(curves[currentCurveId].points.length + 1);
    var currentStepValues = new Float64Array(curves[currentCurveId].points.length + 1);
    currentStepValues[1] = height1;
    polynomialsCtx.clearRect(0,0, width, height);
    polynomialsCtx.lineWidth = plotWidth;
    //Each pixel on the X axis
    for (var k = doublePlotWidth; k < width; k += doublePlotWidth)
    {
      lastStepValues.set(currentStepValues);
      //Clean current step
      currentStepValues = new Float64Array(curves[currentCurveId].points.length + 1);
      currentStepValues[1] = height1;
      //Calc current pixel location - Bernstein polynomials
      for (var j = 1; j < curves[currentCurveId].points.length; j++)
      {
        for (var i = j+1; i > 0; i--)
        {
          currentStepValues[i] = (1 - t) * currentStepValues[i] + t * currentStepValues[i-1];
        }
      }
      //Plot
      for (var poliynomialId = 1; poliynomialId < curves[currentCurveId].points.length + 1; poliynomialId++)
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
  function drawPolygon(polygonPoints, lineWidth, lineColor, dotColor)
  {
      curveCtx.lineWidth = lineWidth;
      curveCtx.beginPath();
      curveCtx.moveTo(polygonPoints[0].x, height1 - polygonPoints[0].y);
      for (var i = 0; i < polygonPoints.length; i++)
      {
        curveCtx.strokeStyle = dotColor;
        curveCtx.strokeRect(polygonPoints[i].x - plotWidth,
                            height1 - polygonPoints[i].y - plotWidth,
                            doublePlotWidth,
                            doublePlotWidth);
        curveCtx.stroke();
        curveCtx.strokeStyle = lineColor;
        curveCtx.lineTo(polygonPoints[i].x, height1 - polygonPoints[i].y);
        curveCtx.stroke();
      }
  }

  function drawCurves()
  {
    curveCtx.clearRect(0,0, width, height);
    for (var i = 0; i < curves.length; i++)
    {
      drawCurve(curves[i], i == currentCurveId);
    }
  }

  function drawCurve(curve, isCurrent)
  {
    var step = 1 / width;
    var canvasSpacePoints = [];

    //Set x,y in canvas coordinates, plot control points
    for (var i = 0; i < curve.points.length; i++)
    {
      canvasSpacePoints[i] = {
        x : curve.points[i].x * width,
        y : curve.points[i].y * height1
      };
    }

    //plot control polygon lines
    curveCtx.lineWidth = plotWidth;
    var lineColor = "#e0e0e0";
    var dotColor = "#a0a0a0";
    if (isCurrent)
    {
      lineColor = "#0000f5";
      dotColor = "#0000f0";
    }
    drawPolygon(canvasSpacePoints, plotWidth, lineColor, dotColor);

    //plot curve
    curveCtx.lineWidth = doublePlotWidth;

    var startCurve = deCasteljau(canvasSpacePoints, t, false)
    var lastStep = startCurve;
    var curveColor = "#a04040";
    if (isCurrent)
    {
      curveColor = "#f00000";
    }
    //Draw Curve step
    for (var t = curve.startT; t < curve.endT; t += step)
    {
      curveStep = deCasteljau(canvasSpacePoints, t, false);
      curveCtx.strokeStyle = curveColor;
      curveCtx.beginPath();
      curveCtx.moveTo(lastStep.x, height1 - lastStep.y);
      curveCtx.lineTo(curveStep.x, height1 - curveStep.y);
      curveCtx.stroke();
      lastStep = curveStep;
    }
    //Draw skeleton
    if (deCasteljauRatio > curve.startT && deCasteljauRatio < curve.endT)
    {
      deCasteljau(canvasSpacePoints, deCasteljauRatio, true);
    }
  }

  function deCasteljau(canvasSpacePoints, t, shouldDraw)
  {
    var skeletonPoints = [];
    //first run - the control points
    skeletonPoints[0] = canvasSpacePoints;

    //"recursive" runs of the algorithm (implemented not recursively)
    for (var j = 1; j < canvasSpacePoints.length; j++)
    {
      skeletonPoints[j] = [];
      //Skeleton points in current iteration
      for (var i = 0; i < canvasSpacePoints.length - j; i++)
      {
        skeletonPoints[j][i] = {
          x : (1 - t) * skeletonPoints[j-1][i].x + t * skeletonPoints[j-1][i + 1].x,
          y : (1 - t) * skeletonPoints[j-1][i].y + t * skeletonPoints[j-1][i + 1].y
        };
      }
      if(shouldDraw)
      {
        curveCtx.font="30px Courier New";
        var roundT=(Math.round(t*100)/100);
        curveCtx.fillText("t=".concat(roundT), 30, 30);
        drawPolygon(skeletonPoints[j], plotWidth, "#00f000", "#0f0f0f");
      }
    }
    return skeletonPoints.pop()[0];
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
    curves[currentCurveId].points[dragId] = getXY(ev);
    drawCurves();
    ev.preventDefault();
  }

  function startDrag(ev)
  {
    var clickCoordinates = getXY(ev);
    if (ev.ctrlKey)
    {
      addPoint(clickCoordinates);
      return;
    }

    //Get closest point to the click
    var minimumDistance = width, distanceSquare, xDelta, yDelta;
    for (var i = 0; i < curves[currentCurveId].points.length; i++)
    {
      xDelta = (clickCoordinates.x - curves[currentCurveId].points[i].x);
      yDelta = (clickCoordinates.y - curves[currentCurveId].points[i].y);
      distanceSquare = xDelta * xDelta + yDelta * yDelta;
      if ( distanceSquare < minimumDistance )
      {
        dragId = i;
        minimumDistance = distanceSquare;
      }
    }
    curves[currentCurveId].points[dragId] = clickCoordinates;
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
    return {
      x : (ev.clientX - rect.left) / width,
      y : (height1 - (ev.clientY - rect.top)) / height
    };
  }
} // end Bezier
