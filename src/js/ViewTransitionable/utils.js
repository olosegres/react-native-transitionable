
export const postfixedTransitionsConfig = {
  margin: [
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'marginHorizontal',
    'marginVertical',
  ],
  padding: [
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'paddingHorizontal',
    'paddingVertical',
  ],
};

export const transformStyleProps = {
  perspective: null,
  rotate: null,
  rotateX: null,
  rotateY: null,
  rotateZ: null,
  scale: null,
  scaleX: null,
  scaleY: null,
  skewX: null,
  skewY: null,
  translateX: null,
  translateY: null,
};

const numericPropNames = {
  margin: null,
  marginTop: null,
  marginRight: null,
  marginBottom: null,
  marginLeft: null,
  marginHorizontal: null,
  marginVertical: null,

  padding: null,
  paddingTop: null,
  paddingRight: null,
  paddingBottom: null,
  paddingLeft: null,
  paddingHorizontal: null,
  paddingVertical: null,

  translateX: null,
  translateY: null,
};

// todo separate react-native-reanimated utils from native
export function extractValue(name, internalSharedValuesRef, externalSharedValuesRef) {
  'worklet';
  const external = externalSharedValuesRef ? externalSharedValuesRef.value : null;
  const internal = internalSharedValuesRef ? internalSharedValuesRef.value : null;
  return external && external[name] !== undefined ? external[name] : internal[name];
}

export function createFlatStyleKit(...styles) {
  let merged = {};
  let externalAnimatedStyles = [];

  // todo add check for amimatedStyles
  for (let s of styles) {
    if (Array.isArray(s)) {
      const { flatStyle, externalAnimatedStyles: nestedExternalAnimatedStyles } = createFlatStyleKit(...s);
      merged = {
        ...merged,
        ...flatStyle,
      };

      if (nestedExternalAnimatedStyles.length) {
        externalAnimatedStyles = externalAnimatedStyles.concat(...externalAnimatedStyles);
      }
    } else if (s) {
      merged = {
        ...merged,
        ...s,
      };
    }
  }

  return { flatStyle: merged, externalAnimatedStyles };
}


function mbArrayToArray(mbArray) {
  return Array.isArray(mbArray) ? mbArray : [...(mbArray ? [mbArray] : [])];
}


function getStartValue(propertyName, value) {
  if (typeof value !== 'undefined') {
    return value;
  }

  // actually shuld not be called without defined value || prevValue

  debugger

  if (propertyName in numericPropNames) {
    return 0;
  }

  if (propertyName === 'opacity') {
    return 1;
  }

  debugger
}

function getFromValue(transitionName, prevTransitionConfig, sharedValue, styleValue) {

  if (transitionName in prevTransitionConfig) {
    return sharedValue;
  }

  return styleValue;
}

// todo update shared value if prevProps withoutTransition and new with it

function getOrCreateSharedValue(
  transitionName,
  internalSharedValuesRef,
  externalSharedValuesRef,
  styleValue,
  prevTransitionConfig,
  debug,
  id, i,
) {
  if (!(transitionName in prevTransitionConfig)) {
    return styleValue;
  }

  const value = extractValue(transitionName, internalSharedValuesRef, externalSharedValuesRef);
  debug && console.log('extractValue', id, i, transitionName, {value});

  if (value === undefined) {
    const startValue = getStartValue(transitionName, styleValue);
    debug && console.log('startValue', id, i, transitionName, {startValue});
    return startValue
  }

  return value;
}

export function createTransitionKit(
  flatStyle,
  prevFlatStyle,
  prevTransitionConfig,
  internalSharedValuesRef,
  externalSharedValuesRef,
  debug,
  id,
  i,
) {
  const {
    transitionTimingFunction,
    transitionProperty,
    transitionDuration,
    transitionDelay,
    transition,
    ...staticStyle
  } = flatStyle;

  if (transition) {
    throw new Error('Shorthand property "transition" in styles is not supported');
  }

  const transitionPropertyArray = mbArrayToArray(transitionProperty);
  const transitionTimingFunctionArray = mbArrayToArray(transitionTimingFunction);
  const transitionDurationArray = mbArrayToArray(transitionDuration);
  const transitionDelayArray = mbArrayToArray(transitionDelay);

  const transitionConfig: TPropertyConfig = {};
  const sharedValues = {};

  for (let transitionIndex = 0; transitionIndex < transitionPropertyArray.length; transitionIndex++) {
    const transitionPropertyName = transitionPropertyArray[transitionIndex];

    const timingFunction = Array.isArray(transitionTimingFunction) ? transitionTimingFunctionArray[transitionIndex] : transitionTimingFunction;
    const duration = Array.isArray(transitionDuration) ? transitionDurationArray[transitionIndex] : transitionDuration;
    const delay = Array.isArray(transitionDelay) ? transitionDelayArray[transitionIndex]: transitionDelay;

    if (transitionPropertyName === 'transform') {

      if (flatStyle.transform) {

        // if (prevFlatStyle?.transitionProperty?.includes('transform')) {
        //   delete staticStyle.transform;
        // }

        staticStyle.transform = [];

        for (let transformConfig of flatStyle.transform) {

          const transitionName = Object.keys(transformConfig)[0];

          if (Object.keys(transformConfig).length > 1) {
            console.warn('not supported transformConfig', transformConfig);
            debugger
          }

          const styleValue = transformConfig[transitionName];

          if (transitionName === 'translateX' && typeof styleValue === 'string') {
            console.warn('translate with string');
            debugger
          }

          sharedValues[transitionName] = getOrCreateSharedValue(
            transitionName,
            internalSharedValuesRef,
            externalSharedValuesRef,
            styleValue,
            prevTransitionConfig,
            debug,
            id, i,
          );

          const from = getFromValue(transitionName, prevTransitionConfig, sharedValues[transitionName], styleValue);

          staticStyle.transform.push({ [transitionName]: from });

          transitionConfig[transitionName] = {
            timingFunction,
            duration,
            delay,
            to: styleValue,
            from,
          };

        }
      }

    } else if (transitionPropertyName in postfixedTransitionsConfig) {
      const possibleTransitionProperties = postfixedTransitionsConfig[transitionPropertyName];

      for (let postfixedPropertyName of possibleTransitionProperties) {
        if (postfixedPropertyName in flatStyle) {

          sharedValues[postfixedPropertyName] = getOrCreateSharedValue(
            postfixedPropertyName,
            internalSharedValuesRef,
            externalSharedValuesRef,
            flatStyle[postfixedPropertyName],
            prevTransitionConfig,
            debug,
            id, i,
          );

          const from = getFromValue(
            postfixedPropertyName,
            prevTransitionConfig,
            sharedValues[postfixedPropertyName],
            flatStyle[postfixedPropertyName],
          );

          staticStyle[postfixedPropertyName] = from;

          transitionConfig[postfixedPropertyName] = {
            timingFunction,
            duration,
            delay,
            to: flatStyle[postfixedPropertyName],
            from,
          };

        }
      }

      if (transitionPropertyName in flatStyle) {

        if (prevFlatStyle?.transitionProperty?.includes(transitionPropertyName)) {
          delete staticStyle[transitionPropertyName];
        }

        sharedValues[transitionPropertyName] = getOrCreateSharedValue(
          transitionPropertyName,
          internalSharedValuesRef,
          externalSharedValuesRef,
          flatStyle[transitionPropertyName],
          prevTransitionConfig,
          debug,
          id, i,
        );

        const from = getFromValue(
          transitionPropertyName,
          prevTransitionConfig,
          sharedValues[transitionPropertyName],
          flatStyle[transitionPropertyName],
        );

        staticStyle[transitionPropertyName] = from;

        transitionConfig[transitionPropertyName] = {
          timingFunction,
          duration,
          delay,
          to: flatStyle[transitionPropertyName],
          from,
        };

      }
    } else {
      if (transitionPropertyName in flatStyle) {

        if (prevFlatStyle?.transitionProperty?.includes(transitionPropertyName)) {
          delete staticStyle[transitionPropertyName];
        }

        sharedValues[transitionPropertyName] = getOrCreateSharedValue(
          transitionPropertyName,
          internalSharedValuesRef,
          externalSharedValuesRef,
          flatStyle[transitionPropertyName],
          prevTransitionConfig,
          debug,
          id, i,
        );

        const from = getFromValue(
          transitionPropertyName,
          prevTransitionConfig,
          sharedValues[transitionPropertyName],
          flatStyle[transitionPropertyName],
        );

        staticStyle[transitionPropertyName] = from;

        transitionConfig[transitionPropertyName] = {
          timingFunction,
          duration,
          delay,
          to: flatStyle[transitionPropertyName],
          from,
        };

      }
    }
  }

  // debug && console.log('+++ config', id, i, { transitionPropertyArray, transitionConfig, sharedValues });

  return { staticStyle, transitionConfig, sharedValues };
}
