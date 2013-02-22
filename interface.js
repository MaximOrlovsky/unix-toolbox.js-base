(function(exports){
  var Promise = function() {
    var callbacks = [];
    var result = null;

    this.then = function(cb) {
      if(result !== null)
        cb(result);
      else
        callbacks.push(cb);

      return this;
    };

    this.fulfil = function(res) {
      result = res;
      for(var i in callbacks) {
        callbacks[i](result);
      }
    }
  };


  exports.Interface = function(worker_script) {
    this.worker = new Worker(worker_script);
    this.promises = [];
    var self = this;


    this.worker.onmessage = function(ev) {
      var obj;
      try{
        obj = JSON.parse(ev.data);
      }
      catch(e) {
        return;
      }

      if('id' in obj)
        self.promises[obj.id].fulfil(obj);
      if(obj.cmd) {
        if(obj.cmd == 'stdout' && typeof(self.on_stdout) === 'function')
          self.on_stdout(obj.contents+'\n')
        if(obj.cmd == 'stderr' && typeof(self.on_stderr) === 'function')
          self.on_stderr(obj.contents+'\n')
      }
    };


    this.addUrl = function(real_url, pseudo_path, pseudo_name) {
      var prom = new Promise();
      self.promises.push(prom);
      self.worker.postMessage(JSON.stringify({
        cmd:         'addUrl',
        id:          (self.promises.length-1),
        real_url:    real_url,
        pseudo_path: pseudo_path,
        pseudo_name: pseudo_name
      }));

      return prom;
    },


    self.mkdir = function(pseudo_path, pseudo_name) {
      var prom = new Promise();
      self.promises.push(prom);
      self.worker.postMessage(JSON.stringify({
        cmd:         'mkdir',
        id:          (self.promises.length-1),
        pseudo_path: pseudo_path,
        pseudo_name: pseudo_name
      }));

      return prom;
    },


    self.getFile = function(pseudo_path, pseudo_name) {
      var prom1 = new Promise();
      self.promises.push(prom1);
      self.worker.postMessage(JSON.stringify({
        cmd:         'getFile',
        id:          (self.promises.length-1),
        pseudo_path: pseudo_path,
        pseudo_name: pseudo_name
      }));

      var prom2 = new Promise();
      var chunks = [];
      prom1.then(function(msg) {
        var id = msg.chunk_id;
        chunks[id] = msg.contents;

        var complete = true;
        for(var i = 0; i < msg.chunk_count; i++) {
          if(typeof(chunks[i]) === 'undefined') {
            complete = false;
            break;
          }
        }

        if(complete) {
          prom2.fulfil(chunks.join(''));
        }
      });

      return prom2;
    },


    this.addData = function(contents, pseudo_path, pseudo_name) {
      var prom = new Promise();
      self.promises.push(prom);
      self.worker.postMessage(JSON.stringify({
        cmd:         'addData',
        id:          (self.promises.length-1),
        contents:    contents,
        pseudo_path: pseudo_path,
        pseudo_name: pseudo_name
      }));
      return prom;
    },


    this.allDone = function() {
      var prom = new Promise();

      var N = this.promises.length;
      for(var i = 0; i < this.promises.length; i++) {
        this.promises[i].then(function() {
          N--;
          if(N == 0)
            prom.fulfil();
        });
      }
      if(this.promises.length === 0)
        prom.fulfil();

      return prom;
    }


    this.run = function() {
      var prom = new Promise();
      self.promises.push(prom);

      var args = [];
      for(var i = 0; i < arguments.length; i++)
        args.push(arguments[i]);

      self.worker.postMessage(JSON.stringify({
        cmd:         'run',
        id:          (self.promises.length-1),
        args:        args
      }));

      return prom;
    }

    exports.Interface.Promise = Promise;
    return this;
  }
})(window);
