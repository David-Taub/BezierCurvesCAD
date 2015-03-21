$( document ).ready(function()
{
    var b1 = new main( .4, [ .1, .9, .9, .5], [.1, .9, .1, .1]);

});


function main(scale, ptX, ptY)
{
  var HISTORY_MAX_SIZE = 50;
  var history = [], forwardHistory = [];
  var currentCurveId = 0;
  var timer, deCasteljauRatio = 1;
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
      endT : 1
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
    $("#slider").value = $("#slider").max;
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
    $("#slider").on("change mousemove", function()
    {
      clearInterval(timer);
      deCasteljauRatio = this.value/this.max;
      drawCurves()
    });

    //Mobile support
    $(document).keyup(onKeyUp);
    $(document).resize(resize);
  }

  function undo()
  {
    if (history.length == 0)
    {
      return;
    }
    forwardHistory.push(curves);

    curves = history.pop();
    updateCurvesList();
    resize();
  }

  function redo()
  {
    if (forwardHistory.length == 0)
    {
      return;
    }
    history.push(curves);
    curves = forwardHistory.pop();
    updateCurvesList();
    resize();
  }

  function pushToHistory()
  {
    //Deep copy
    curvesCopy = [];
    for (var i = 0; i < curves.length; i++)
    {
      curvesCopy.push({
        startT : curves[i].startT,
        endT : curves[i].endT,
        points : curves[i].points.slice()
      });
    }
    history.push(curvesCopy);
    if (history.length > HISTORY_MAX_SIZE)
    {
      history.shift();
    }
    forwardHistory = [];
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
    if($("#curvesList option").size() > currentCurveId)
    {
      $("#curvesList").val(currentCurveId + 1);
    }
    else
    {
      $("#curvesList").val(1);
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
      pushToHistory();
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
      //S
      case 83:
        splitCurve();
        break;
      //C
      case 67:
        drawDeCasteljau();
        break;
      //M
      case 77:
        mergeCurves();
        break;
      //Z
      case 90:
        if (ev.ctrlKey)
        {
          undo();
        }
        break;
      //Y
      case 89:
        if (ev.ctrlKey)
        {
          redo();
        }
        break;
    }
  }

  function splitCurve()
  {
    //check if t value is in range
    if (deCasteljauRatio <= curves[currentCurveId].startT ||
        deCasteljauRatio >= curves[currentCurveId].endT)
    {
      return;
    }
    pushToHistory();
    var skeletonPoints = deCasteljau(curves[currentCurveId].points, deCasteljauRatio);
    //build two curves
    var postfixCurve = {
      points : [],
      startT : 0,
      endT : (curves[currentCurveId].endT - deCasteljauRatio) / (1 - deCasteljauRatio)
    };
    var prefixCurve = {
      points : [],
      startT : curves[currentCurveId].startT / deCasteljauRatio,
      endT : 1
    };
    //add points to new curves
    for (var i = 0; i < curves[currentCurveId].points.length; i++)
    {
      prefixCurve.points.push(skeletonPoints[i][0]);
      postfixCurve.points.push(skeletonPoints[curves[currentCurveId].points.length - i - 1][i])
    }
    //add new curves to the curves list
    curves[currentCurveId] = prefixCurve;
    curves.push(postfixCurve);

    updateCurvesList();
    resize();
  }

  function drawDeCasteljau()
  {
    deCasteljauRatio = 0;
    timer = window.setInterval(stepDeCasteljau, 5);
  }

  function stepDeCasteljau()
  {
    deCasteljauRatio += 0.001;
    //Stop
    if(deCasteljauRatio >= 1)
    {
      clearInterval(timer);
      return;
    }
    $("#slider").val(deCasteljauRatio * $("#slider").prop('max'));
    drawCurves();
  }

  //Add point as last in polygon, coordinates are between 0 to 1
  //e.g. addPoint(0.3, 0.5)
  function addPoint(newPoint, isNewCurve)
  {
    if (!isNewCurve)
    {
      curves[currentCurveId].points.push(newPoint);
      resize();
      return;
    }
    curves.push({
      points : [newPoint],
      startT : 0,
      endT : 1
    });
    currentCurveId = curves.length - 1;
    updateCurvesList();
    resize();
  }

  //Delete last point in polygon
  function deletePoint()
  {
    pushToHistory();
    curves[currentCurveId].points.pop();
    //curve is empty, delete it
    if (curves[currentCurveId].points.length == 0)
    {
      curves.splice(currentCurveId, 1);
      currentCurveId--;
      updateCurvesList();
    }
    resize();
  }

  function findClosestCurve()
  {
    var minimum = 1;
    var minimumId = currentCurveId;
    for (var i = 0; i < curves.length; i++)
    {
      if (i != currentCurveId)
      {
        var distanceSquare = standardMeeting(currentCurveId, i);
        if (distanceSquare < minimum)
        {
          minimum = distanceSquare;
          minimumId = i;
        }
      }
    }
    return minimumId;
  }

  function mergeCurves()
  {
    var slaveId = findClosestCurve();
    var masterId = currentCurveId;
    //Curves without enough points or not enough curves
    if (curves[masterId].points.length < 2
        || curves[slaveId].points.length < 2
        || masterId == slaveId)
    {
      return;
    }
    pushToHistory();
    //Flip curves order if necessary, so last of master is close to first of slave
    standardMeeting(masterId, slaveId, true);

    //remove last point of master
    var masterLastPoint1 = curves[masterId].points.pop();
    var masterLastPoint2 = curves[masterId].points[curves[masterId].points.length - 1];

    var lastEdgeOfMaster = calcDistanceSquare(masterLastPoint1, masterLastPoint2);
    var firstEdgeOfSlave = calcDistanceSquare(masterLastPoint1, curves[slaveId].points[1]);

    //correct first edge of the slave curve
    var ratio = 1 + Math.sqrt(firstEdgeOfSlave / lastEdgeOfMaster);
    curves[slaveId].points[1].x = (1 - ratio) * masterLastPoint2.x + ratio * masterLastPoint1.x;
    curves[slaveId].points[1].y = (1 - ratio) * masterLastPoint2.y + ratio * masterLastPoint1.y;

    //merge two curves into one
    //remove first point of slave
    curves[slaveId].points.splice(0, 1);
    curves[masterId].points = curves[masterId].points.concat(curves[slaveId].points);

    //remove slave curve
    curves.splice(slaveId, 1);
    if (masterId > slaveId)
    {
      currentCurveId--;
    }
    updateCurvesList();
    resize();
  }

  function standardMeeting(masterId, slaveId, reverseToStandard)
  {
    var masterPoints = curves[masterId].points;
    var slavePoints = curves[slaveId].points;

    var firstToFirst = calcDistanceSquare(masterPoints[0], slavePoints[0]);
    var firstToLast = calcDistanceSquare(masterPoints[0], slavePoints[slavePoints.length - 1]);
    var lastToFirst = calcDistanceSquare(masterPoints[masterPoints.length - 1], slavePoints[0]);
    var lastToLast = calcDistanceSquare(masterPoints[masterPoints.length - 1], slavePoints[slavePoints.length - 1]);
    if (!reverseToStandard)
    {
      return Math.min(firstToFirst, firstToLast, lastToFirst, lastToLast);
    }
    switch (Math.min(firstToFirst, firstToLast, lastToFirst, lastToLast))
    {
      case firstToFirst:
        curves[masterId].points = masterPoints.reverse()
        break;
      case firstToLast:
        curves[masterId].points = masterPoints.reverse()
        curves[slaveId].points = slavePoints.reverse()
        break;
      case lastToLast:
        curves[slaveId].points = slavePoints.reverse()
        break;
    }
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
        //Dot
        curveCtx.strokeStyle = dotColor;
        curveCtx.strokeRect(polygonPoints[i].x - plotWidth,
                            height1 - polygonPoints[i].y - plotWidth,
                            doublePlotWidth,
                            doublePlotWidth);
        curveCtx.stroke();
        //Line
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
    if (deCasteljauRatio == 1)
    {
      return;
    }
    //Write the t value
    curveCtx.font="30px Courier New";
    var roundT = (Math.round(deCasteljauRatio*100)/100);
    curveCtx.fillText("t=".concat(roundT), 30, 30);
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
    //disabled colors
    var lineColor = "#e0e0e0";
    var dotColor = "#a0a0a0";
    if (isCurrent)
    {
      //enabled colors
      lineColor = "#0000f5";
      dotColor = "#0000f0";
    }
    drawPolygon(canvasSpacePoints, plotWidth, lineColor, dotColor);

    //plot curve
    curveCtx.lineWidth = doublePlotWidth;

    var startCurve = deCasteljau(canvasSpacePoints, t).pop()[0]
    var lastStep = startCurve;
    var curveColor = "#a04040";
    if (isCurrent)
    {
      curveColor = "#f00000";
    }
    //Draw Curve step
    for (var t = curve.startT; t < curve.endT; t += step)
    {
      curveStep = deCasteljau(canvasSpacePoints, t).pop()[0];
      curveCtx.strokeStyle = curveColor;
      curveCtx.beginPath();
      curveCtx.moveTo(lastStep.x, height1 - lastStep.y);
      curveCtx.lineTo(curveStep.x, height1 - curveStep.y);
      curveCtx.stroke();
      lastStep = curveStep;
    }
    //Draw De Casteljau skeleton
    if (deCasteljauRatio > curve.startT && deCasteljauRatio < curve.endT)
    {
      var deCasteljauPoints = deCasteljau(canvasSpacePoints, deCasteljauRatio);
      for (var j = 1; j < deCasteljauPoints.length; j++)
      {
        drawPolygon(deCasteljauPoints[j], plotWidth, "#00f000", "#0f0f0f");
      };
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

    }
    return skeletonPoints;
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

  function calcDistanceSquare(a, b)
  {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  }

  function startDrag(ev)
  {
    pushToHistory();
    var clickCoordinates = getXY(ev);
    if (ev.ctrlKey)
    {
      addPoint(clickCoordinates, ev.shiftKey);
      return;
    }

    //Get closest point to the click
    var minimumDistance = width, distanceSquare, xDelta, yDelta;
    for (var i = 0; i < curves[currentCurveId].points.length; i++)
    {
      distanceSquare = calcDistanceSquare(clickCoordinates, curves[currentCurveId].points[i]);;
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
}
