/**
 * Created by aolc on 2018/5/22.
 */

let backFunctionKeys = [];
let backFunctionsMap = new Map();

function removeIndex(array, index) {
  return array.filter((_, itemIndex) => itemIndex !== index);
}

function removeKey(array, key) {
  return array.filter((item) => item !== key);
}

const handleBack = () => {
  if (backFunctionKeys.length > 0) {
    const functionKey = backFunctionKeys.at(-1);
    backFunctionKeys = removeIndex(backFunctionKeys, backFunctionKeys.length - 1);
    const functionA = backFunctionsMap.get(functionKey);
    backFunctionsMap.delete(functionKey);
    functionA?.();
    return false;
  }
  return true;
};

const addBackFunction = (key, functionA) => {
  backFunctionsMap.set(key, functionA);
  backFunctionKeys.push(key);
};

const removeBackFunction = key => {
  backFunctionKeys = removeKey(backFunctionKeys, key);
  backFunctionsMap.delete(key);
};

export default {
  handleBack,
  addBackFunction,
  removeBackFunction,
};
