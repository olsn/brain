const ARR_LEN = 300;
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

// convnet.js
var layer_defs = [];
layer_defs.push({type:'input', out_sx: 1, out_sy: 1, out_depth: ARR_LEN});
layer_defs.push({type:'fc', num_neurons: 100, activation: 'sigmoid'});
layer_defs.push({type:'fc', num_neurons: 30, activation: 'relu'});
layer_defs.push({type:'fc', num_neurons: 5, activation: 'tanh'});
layer_defs.push({type:'softmax', num_classes:2});

convNet = new convnetjs.Net();
convNet.makeLayers(layer_defs);
convTrainer = new convnetjs.SGDTrainer(convNet, {learning_rate:0.1, momentum:0.1, batch_size:10, l2_decay:0.001});

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
  var mouseY$ = Rx.Observable.interval(10)
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
    input: interpolateArray([0], ARR_LEN),
    output: [0]
  }],
  goodExamples: [],

  pickData : function(dataArray, output) {
    this.goodExamples.push(interpolateArray(dataArray, ARR_LEN))
    var result = { input: interpolateArray(dataArray, ARR_LEN),
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

      convNetTrain(this.data);
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
    var completed = progress.iterations / trainer.iterations * 100;
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
    const inputArr = interpolateArray(data, ARR_LEN);
    var output = this.runNetwork(inputArr);
    var convNetOutput = convNet.forward(new convnetjs.Vol(inputArr));
    $("#output33").text(JSON.stringify(output) + ", convNet: " + convNetOutput.w[1]);
  }
}

function interpolateArray(data, fitCount) {
    while (data.length < fitCount) {
      data.push(0);
    }

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

function convNetTrain(sets) {
  for (var c = 0; c < 500; ++c) {
    sets.forEach(set => {
      var x = new convnetjs.Vol(set.input);
      convTrainer.train(x, set.output[0]);
    });
  }
}
