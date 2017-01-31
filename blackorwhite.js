var cursorX;
var cursorY;
document.onmousemove = function(e) {
    cursorX = e.pageX;
    cursorY = e.pageY;
};

$(document).ready(function(){
  $("#progress-box").hide();
  $("#testing-box").hide();
  $("#code-box").hide();

  // only show nn and yiq
  $("#test-box").hide();

  var startBtn = document.getElementById("start-button");
  var clickedStart$ = Rx.Observable.fromEvent(startBtn, "click");
  var testBtn = document.getElementById("eval-button");
  var clickedTest$ = Rx.Observable.fromEvent(testBtn, "click");
  var mouseY$ = Rx.Observable.interval(50)
    .map(() => cursorY);

  var recordData$ = clickedStart$
    .switchMap(() => {
      const cVal = cursorY;
      return mouseY$
        .skipUntil(mouseY$.filter(val => val >= cVal + 5))
        .takeUntil(mouseY$
          .skipUntil(mouseY$.filter(val => val >= cVal + 5))
          .filter(val => val < cVal + 5))
        .toArray();
    });
    recordData$.subscribe(data => trainer.pickData(data));

    var testData$ = clickedTest$
      .switchMap(() => {
        const cVal = cursorY;
        return mouseY$
          .skipUntil(mouseY$.filter(val => val >= cVal + 5))
          .takeUntil(mouseY$
            .skipUntil(mouseY$.filter(val => val >= cVal + 5))
            .filter(val => val < cVal + 5))
          .toArray();
    });
    testData$.subscribe(data => tester.evaluate(data));
});

var trainer = {

  data : [{
    input: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    output: [0]
  }],

  pickData : function(dataArray) {
    dataArray.length = 30;
    var result = { input: dataArray,
                   output: [1]};
    this.data.push(result);

    // show the "Train network" button after we've selected a few entries
    if (this.data.length == 5) {
      $("#test-box").show();
    }
  },

  trainNetwork : function() {
    $("#training-box").hide();
    $("#progress-box").show();

    if(window.Worker) {
      var worker = new Worker("training-worker.js");
      worker.onmessage = this.onMessage;
      worker.onerror = this.onError;
      worker.postMessage(JSON.stringify(this.data));
    }
    else {
      var net = new brain.NeuralNetwork();
      net.train(this.data, {
        iterations: 9000
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
    data.length = 30;
    var output = this.runNetwork(data);
    $("#output33").text(JSON.stringify(output));
  }
}
