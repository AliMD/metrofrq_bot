
async function rand () {
  return Math.random();
}

function test0 () {
  console.log( rand() );
}

function test0 () {
  rand()
  .then((val) => {
    console.log(val);
  })
  ;
}

async function test0 () {
  console.log( await rand() );
}




function getValues () {
  console.log('getValues');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve([1, 2, 3, 4]);
    }, 500);

    // or when error happened
    // reject('Error message.');
  });
}

function changeValue (value) {
  console.log(`asyncOperation: ${value}`);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(value*2);
    }, 500);
  });
}

function test0 () {
  console.log( getValues() );
}

function test0 () {
  getValues()
  .then((values) => {
    console.log(values);
  })
  ;
}

async function test0() {
    console.log( await getValues() );
}

function test0 () {
  getValues()
  .then((values) => {
    console.log(values);
    var promies = values.map((value) => {
      return changeValue(value);
    });
    // console.log(promies)
    return Promise.all(promies);
  })
  .then((values) => {
    console.log(values);
  })
  ;
}

async function test () {
  var values = await getValues();
  console.log(values);

  var newvalues = await Promise.all(values.map((value) => {
    return changeValue(value);
  }));

  console.log(newvalues);
}

async function test0 () {
  var values = await getValues();
  console.log(values);

  var newvalues = await Promise.all(values.map((value) => {
    return changeValue(value);
  }));

  console.log(newvalues);
}


test();

console.log('idle ;)');
