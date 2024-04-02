var gl;
var program;

var points;
var hull;
var animation;

var animationFlag = 0;
var animationTime = 300;

var currentXTransform = 0.0;
var currentYTransform = 0.0;
var zoom = 1.0;
var isDragging = false;
var startX, startY;


window.onload = function init(){
    var canvas = document.getElementById( "gl-canvas" );
     gl = WebGLUtils.setupWebGL( canvas );    
     if ( !gl ) { alert( "WebGL isn't available" ); 
}        
// Three Vertices        

// var vertices = [
//         vec2( -1, -1 ),
//         vec2(  0,  1 ),
//         vec2(  1, -1 )    
// ];    

// Get the HTML elements
var nValueInput = document.getElementById("n-value");
var drawButton = document.getElementById("draw-button");
//var distributionDropdown = document.getElementById("distribution-select");
//var algorithmDropdown = document.getElementById("algorithm-select");
var calculateButton = document.getElementById("calculate-hull-button");
var animateButton = document.getElementById("animate-hull-button");


// Add event listener to the draw button
drawButton.addEventListener("click", createPoints);
calculateButton.addEventListener("click", calculateHull);
animateButton.addEventListener("click", calculateAnimation);

var isDragging = false;
var startX, startY;
var currentX, currentY;

// Set up mouse event listeners
canvas.addEventListener("mousedown", function(event) {
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
});

canvas.addEventListener("mousemove", function(event) {
    if (isDragging) {
        var deltaX = 2 * (event.clientX - startX) / canvas.width;
        var deltaY = 2 * (event.clientY - startY) / canvas.height;
        currentXTransform += deltaX / zoom;
        currentYTransform -= deltaY / zoom; // Invert y-axis for canvas coordinates
        startX = event.clientX;
        startY = event.clientY;
        console.log("Dragging - DeltaX:", deltaX, "DeltaY:", deltaY);
        render();
    }
});

canvas.addEventListener("mouseup", function(event) {
    isDragging = false;
});

canvas.addEventListener("wheel", function(event) {
    var delta = event.deltaY;
    if (delta < 0) {
        zoom *= 1.1; // Zoom in
    } else {
        zoom *= 0.9; // Zoom out
    }
    console.log("Zoom:", zoom);
    render();
});

canvas.addEventListener("click", function(event) {
    var rect = canvas.getBoundingClientRect();
    var clickX = (event.clientX - rect.left) / canvas.width * 2 - 1;
    var clickY = 1 - (event.clientY - rect.top) / canvas.height * 2; // Invert y-axis for canvas coordinates

    clickX = (clickX) / (zoom) - currentXTransform;
    clickY = (clickY) / (zoom) - currentYTransform;

    points.push(vec2(clickX, clickY));
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    render();
});

//  Configure WebGL   
//    
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );   
     
//  Load shaders and initialize attribute buffers

    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );        

// Load the data into the GPU        

    var bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    // gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW ); 
	
// Associate out shader variables with our data buffer

      var vPosition = gl.getAttribLocation( program, "vPosition" );
      gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
      gl.enableVertexAttribArray( vPosition );    
      render();
};



function render() {
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );

    var xTransformLoc = gl.getUniformLocation(program, "xTransform");
    var yTransformLoc = gl.getUniformLocation(program, "yTransform");
    var zoomLoc = gl.getUniformLocation(program, "zoom");

    gl.uniform1f(xTransformLoc, currentXTransform);
    gl.uniform1f(yTransformLoc, currentYTransform);
    gl.uniform1f(zoomLoc, zoom);

    gl.clear( gl.COLOR_BUFFER_BIT ); 
    gl.drawArrays( gl.POINTS, 0, points.length );
}

function renderHull(){
    render();

    if(hull){
        gl.bufferData( gl.ARRAY_BUFFER, flatten(hull), gl.STATIC_DRAW );
        gl.drawArrays( gl.LINE_STRIP, 0, hull.length );
    }

}

function renderAnimation(){
    render();
    renderHull();

    gl.bufferData( gl.ARRAY_BUFFER, flatten(animation), gl.STATIC_DRAW );
    gl.drawArrays( gl.LINE_STRIP, 0, animation.length );
}

// Standard Normal variate using Box-Muller transform.
function gaussianRandom(mean=0, stdev=1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function createPoints() {
    console.log("zorrt");
    var n = parseInt(document.getElementById("n-value").value);
    if (isNaN(n) || n <= 0) {
        alert("Please enter a valid positive integer for n.");
        return;
    }

    var distributionType = document.getElementById("distribution-select").value;
    
     // Generate n random points
     points = [];
     hull = [];
     animation = [];
     if (distributionType === "normal") {
        for (var i = 0; i < n; i++) {
            var x = Math.random() * 2 - 1; // Random x coordinate in range [-1, 1]
            var y = Math.random() * 2 - 1; // Random y coordinate in range [-1, 1]
            points.push(vec2(x, y));
        }
    }
    else if(distributionType === "gaussian"){
        for (var i = 0; i < n; i++) {
            var x = gaussianRandom(0,0.2); // Random x coordinate in range [-1, 1]
            var y = gaussianRandom(0,0.2); // Random y coordinate in range [-1, 1]
            points.push(vec2(x, y));    
        }
    }
   
   
    

    // Update the buffer with the new points
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );
    render();
}

async function calculateHull() {
    console.log("calc hull\n");

    //Sort points
    points.sort(function(a, b) {
        if (a[1] !== b[1]) {
            return a[1] - b[1]; // Sort by y-coordinate first
        } else {
            return a[0] - b[0]; // If y-coordinates are equal, sort by x-coordinate
        }
    });    //hull = points;
    var p1 = points[0];
    var p2 = points[points.length - 1];

    var curID = 0;
    var curPoint = points[curID];

    var lowestAngle;
    var lowestID;
    
    var angle;
    
    //Bottom to Top Query
    while(true){

        hull.push(curPoint);

        lowestAngle = 4;
        for(var j = curID; j < points.length; j++){
            angle = Math.atan2( curPoint[1] - points[j][1], curPoint[0] - points[j][0] );
            console.log(j);

            //Animation
            if(animationFlag){
                animation = [curPoint , points[j]];
                await sleep(animationTime);
                renderAnimation();
            }

            if(angle < lowestAngle){
                lowestAngle = angle;
                lowestID = j;
            }
        }

        curPoint = points[lowestID];
        curID = lowestID;

        if(curPoint == p2) break;
    }

    //Top to Bottom Query
    while(true){

        hull.push(curPoint);

        lowestAngle = 4;
        for(var j = 0; j < curID; j++){
            angle = Math.atan2( - curPoint[1] + points[j][1], -curPoint[0] + points[j][0] );
            console.log(j);

            //Animation
            if(animationFlag){
                animation = [curPoint , points[j]];
                await sleep(animationTime);
                renderAnimation();
            }

            if(angle < lowestAngle){
                lowestAngle = angle;
                lowestID = j;
            }
        }

        curPoint = points[lowestID];
        curID = lowestID;

        if(curPoint == p1) break;
    }

    animationFlag = 0;
    renderHull();
}



function calculateAnimation() {
    console.log("Anime >_<\n");
    animationFlag = 1;
    return;
}

var sleepSetTimeout_ctrl;
function sleep(ms) {
    clearInterval(sleepSetTimeout_ctrl);
    return new Promise(resolve => sleepSetTimeout_ctrl = setTimeout(resolve, ms));
}