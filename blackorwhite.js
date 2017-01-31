var cursorX;
var cursorY;
var lx=0, ly=0;
var dX=0, dY=0;
document.onmousemove = function(e) {
    cursorX = e.pageX;
    cursorY = e.pageY;
    dX = e.pageX - lx;
    dY = e.pageY - ly;
    lx = e.pageX;
    ly = e.pageY;
};

$(document).ready(function(){
  $("#progress-box").hide();
  $("#testing-box").hide();
  $("#code-box").hide();

  // only show nn and yiq
  $("#test-box").hide();

  var startBtn = document.getElementById("start-button");
  var clickedStart$ = Rx.Observable.fromEvent(startBtn, "click");
  var startBadBtn = document.getElementById("start-bad-button");
  var clickedBadStart$ = Rx.Observable.fromEvent(startBadBtn, "click");
  var testBtn = document.getElementById("eval-button");
  var clickedTest$ = Rx.Observable.fromEvent(testBtn, "click");
  var mouseY$ = Rx.Observable.interval(5)
    .map(() => cursorY);

    clickedStart$
      .switchMap(() => {
        const cVal = ly;
        return mouseY$
          .skipUntil(mouseY$.filter(val => val >= cVal + 5))
          .takeUntil(mouseY$
            .skipUntil(mouseY$.filter(val => val >= cVal + 5))
            .filter(val => val < cVal + 5))
          .map(() => dY)
          .toArray();
      }).subscribe(data => trainer.pickData(data, 1));

    clickedBadStart$
      .switchMap(() => {
        const cVal = cursorY;
        return mouseY$
          .skipUntil(mouseY$.filter(val => val >= cVal + 5))
          .takeUntil(mouseY$
            .skipUntil(mouseY$.filter(val => val >= cVal + 5))
            .filter(val => val < cVal + 5))
          .map(() => dY)
          .toArray();
    }).subscribe(data => trainer.pickData(data, 0));

    var testData$ = clickedTest$
      .switchMap(() => {
        const cVal = cursorY;
        return mouseY$
          .skipUntil(mouseY$.filter(val => val >= cVal + 5))
          .takeUntil(mouseY$
            .skipUntil(mouseY$.filter(val => val >= cVal + 5))
            .filter(val => val < cVal + 5))
          .map(() => dY)
          .toArray();
    });
    testData$.subscribe(data => tester.evaluate(data));
});

var trainer = {

  data : [{
    input: interpolateArray([0], 300),
    output: [0]
  }],
  goodExamples: [],

  pickData : function(dataArray, output) {
    this.goodExamples.push(interpolateArray(dataArray, 300))
    var result = { input: interpolateArray(dataArray, 300),
                   output: [output]};
    this.data.push(result);
    $("#chart1").text(" ");
    $.jqplot('chart1', this.goodExamples, {
      seriesDefaults: {
          markerOptions: {
              show: false
          }
      }
    });

    // show the "Train network" button after we've selected a few entries
    if (this.data.length == 5) {
      $("#test-box").show();
    }
  },

  trainNetwork : function() {
    $("#training-box").hide();
    $("#progress-box").show();

    if(false && window.Worker) {
      var worker = new Worker("training-worker.js");
      worker.onmessage = this.onMessage;
      worker.onerror = this.onError;
      worker.postMessage(JSON.stringify(this.data));
    }
    else {var net = new brain.NeuralNetwork({
      hiddenLayers: [100]
    });

    net.train(this.data, {
      errorThresh: 0.005,  // error threshold to reach
      iterations: 20000,   // maximum training iterations
      log: true,           // console.log() progress periodically
      logPeriod: 500,       // number of iterations between logging
      learningRate: 0.05
    });
      tester.show(net);
    }
  },

  onMessage : function(event) {
    var data = JSON.parse(event.data);
    if(data.type == 'progress') {
      trainer.showProgress(data);
    }
    else if(data.type == 'result') {
      var net = new brain.NeuralNetwork().fromJSON(data.net);
      tester.show(net);
    }
  },

  onError : function(event) {
    $("#training-message").text("error training network: " + event.message);
  },

  showProgress : function(progress) {
    var completed = progress.iterations / trainer.iterations * 300;
    $("#progress-completed").css("width", completed + "%");
  }
}

var tester = {
  show : function(net) {
    $("#progress-box").hide();
    this.runNetwork = net.toFunction();
    $("#testing-box").show();
  },

  evaluate: function(data) {
    var output = this.runNetwork(interpolateArray(data, 300));
    $("#output33").text(JSON.stringify(output));
  }
}

function interpolateArray(data, fitCount) {

    var linearInterpolate = function (before, after, atPoint) {
        return before + (after - before) * atPoint;
    };

    var newData = new Array();
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0]; // for new allocation
    for ( var i = 1; i < fitCount - 1; i++) {
        var tmp = i * springFactor;
        var before = new Number(Math.floor(tmp)).toFixed();
        var after = new Number(Math.ceil(tmp)).toFixed();
        var atPoint = tmp - before;
        newData[i] = linearInterpolate(data[before], data[after], atPoint);
    }
    newData[fitCount - 1] = data[data.length - 1]; // for new allocation
    return newData;
};
