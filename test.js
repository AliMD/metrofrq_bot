function getValues() {
  console.log('getValues');
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 500, [1, 2, 3]);
  });
}

function asyncOperation(value) {
  console.log(`asyncOperation: ${value}`);
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 500, value+1);
  });
}

function foo1() {
  return getValues()
  .then((values) => {
    var operations = values.map((value) => {
        return asyncOperation(value)
        .then((newValue) => {
            console.log(newValue);
            return newValue;
        });
    });

    return Promise.all(operations);
  })
  .then((data) => {
    console.log('Finish:', data);
  })
  .catch((err) => {
    console.log('We had an ', err);
  })
  ;
}

// foo1();

function foo2() {
    return getValues().then((values) => {
        var operations = values.map(asyncOperation);

        return Promise.all(operations)
        .then((newValues) => {
            newValues.forEach((newValue) => {
                console.log(newValue);
            });
            return newValues; //#1
        });
    })
    .then((data) => {
      console.log('Finish:', data); //#1
    })
    .catch(function(err) {
        console.log('We had an ', err);
    });
}

// foo2();

function foo3() {
  var newValues = [];
  return getValues()
  .then((values) => {
    return values.reduce(function(previousOperation, value) {
        return previousOperation.then(() => {
            return asyncOperation(value);
        }).then((newValue) => {
            console.log(newValue);
            newValues.push(newValue);
        });
    }, Promise.resolve())// init value for previousOperation
    .then(() => {
      return newValues;
    });
  })
  .then((data) => {
    console.log('Finish:', data);
  })
  .catch(function(err) {
    console.log('We had an ', err);
  });
}

// foo3()

function foo4() {
  return getValues().then((values) => {
    return values.reduce((previousOperation, value) => {
      return previousOperation.then((newValues) => {
        console.log(newValues);
        return asyncOperation(value).then((newValue) => {
            console.log(newValue);
            newValues.push(newValue);
            return newValues;
        });
      });
    }, Promise.resolve([]));
  })
  .then((data) => {
    console.log('Finish:', data);
  })
  .catch(function(err) {
      console.log('We had an ', err);
  });
}

// foo4()


async function foo5() {
    if( Math.round(Math.random()) )
        return 'Success!';
    else
        throw 'Failure!';
}

// Is equivalent to...

function foo6() {
    if( Math.round(Math.random()) )
        return Promise.resolve('Success!');
    else
        return Promise.reject('Failure!');
}

// foo5()
// .then((value) => {
//   console.log(value);
// });


console.log('idle ;)');
