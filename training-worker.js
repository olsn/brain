importScripts("brain-0.6.3.js");

onmessage = function(event) {
  var data = JSON.parse(event.data);
  var net = new brain.NeuralNetwork({
    hiddenLayers: [50]
  });

  net.train(data, {
    callback: postProgress,
    callbackPeriod: 500,
    errorThresh: 0.05,  // error threshold to reach
    iterations: 5000000,   // maximum training iterations
    log: true,           // console.log() progress periodically
    logPeriod: 500,       // number of iterations between logging
    learningRate: 0.05
  });

  postMessage(JSON.stringify({type: 'result', net: net.toJSON()}));
}

function postProgress(progress) {
  progress.type = 'progress'
  postMessage(JSON.stringify(progress));
}
