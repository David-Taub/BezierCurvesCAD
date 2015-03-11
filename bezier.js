function Bezier(curveCanvasId, polynomialsCanvasId, scale, ptX, ptY){

  var curveCanvas, polynomialsCanvas, curveCtx, polynomialsCtx, width,h,h1, d,d2,  dragId = -1;
  var n = ptX.length, n1 = n+1;
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
  window.addEventListener('resize', resize, false);
  resize();

  function drawBernsteinPolynomial()
  {
    var step = doublePlotWidth / (width - doublePlotWidth), t = step;
    var B = new Float64Array(n1);
    var Bo = new Float64Array(n1);
    var Bold = new Float64Array(n1);
    B[1] = Bo[1] = height1;
    polynomialsCtx.clearRect(0,0, width, height);
    polynomialsCtx.lineWidth = plotWidth;
    for (var k = doublePlotWidth; k < width; k += doublePlotWidth){
     Bold.set(B);
     B.set(Bo);
     for (var j = 1; j < n; j++){
      for (var i = j+1; i > 0; i--)
       B[i] = (1-t)*B[i] + t*B[i-1];
     }
     for (var m = 1; m < n1; m++){
      polynomialsCtx.strokeStyle = iColor[(m-1) % 7];
      polynomialsCtx.beginPath();  polynomialsCtx.moveTo(k-d2, height1-Bold[m]);  polynomialsCtx.lineTo(k, height1-B[m]);
      polynomialsCtx.stroke();
     }
     t += step;
    }
  }

  function drawCurve()
  {
    var step = 1 / width, t = step;
    var pointsXi = new Float64Array(n), pointsYi = new Float64Array(n);
    var scpointsX = new Float64Array(n), scpointsY = new Float64Array(n);
    var X,Y;
    curveCtx.clearRect(0,0, width, height);
    curveCtx.lineWidth = plotWidth;
    curveCtx.strokeStyle = "#0000f0";
    for (var i = 0; i < n; i++)
    {
      X = scpointsX[i] = pointsX[i] * width;
      Y = scpointsY[i] = pointsY[i] * height;
      curveCtx.strokeRect(X - plotWidth, height1 - Y - plotWidth, doublePlotWidth, doublePlotWidth);
    }
    if ( n > 2 ){
      curveCtx.beginPath();  curveCtx.moveTo(scpointsX[0], height1 - scpointsY[0]);
      for (var i = 1; i < n; i++)
      {
        curveCtx.lineTo(scpointsX[i], height1 - scpointsY[i]);
      }
      curveCtx.stroke();
    }
    curveCtx.lineWidth = doublePlotWidth;
    curveCtx.strokeStyle = "#f00000";
    curveCtx.beginPath();  curveCtx.moveTo(scpointsX[0], height1 - scpointsY[0]);
    for (var k = 1; k < width; k++)
    {
      pointsXi.set(scpointsX);
      pointsYi.set(scpointsY);
      for (var j = n - 1; j > 0; j--)
      {
        for (var i = 0; i < j; i++)
        {
          pointsXi[i] = (1-t)*pointsXi[i] + t*pointsXi[i+1];
          pointsYi[i] = (1-t)*pointsYi[i] + t*pointsYi[i+1];

        }
      }
      curveCtx.lineTo(pointsXi[0], height1 - pointsYi[0]);
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
    var minimumDistance = width, distanceSquare, xDelta, yDelta;
    //Get closest point to the click
    for (var i = 0; i < n; i++)
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
    if (!ev.clientX) ev = ev.touches[0];
    var rect = curveCanvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / width,
        y = (h1 - (ev.clientY - rect.top)) / height;
    return [x, y];
  }
} // end Bezier
