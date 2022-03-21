import React, { useEffect, useRef, useMemo } from 'react';
import Animated, {
  withTiming,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  createFlatStyleKit,
  createTransitionKit,
  extractValue,
  transformStyleProps,
} from './utils.js';
import timingFunctions from './timingFunctions.js';

function updateSharedValues(
  internalSharedValuesRef,
  externalSharedValuesRef,
  transitionConfig,
  debug,
  id, i,
) {
  'worklet';

  Object.keys(transitionConfig).forEach(name => {
    const external = externalSharedValuesRef ? externalSharedValuesRef.value : null;

    const { to, from } = transitionConfig[name];

    if (to === from || from === undefined) {
      return;
    }

    const sharedContainer = (external && external[name] !== undefined) ? externalSharedValuesRef : internalSharedValuesRef;

    debug && console.log('+++ ++ updatingShared', id, i, name, {
      to, from,
    });

    sharedContainer.value = Object.assign({}, sharedContainer.value, {
      [name]: to,
    });
  });

}

export default function ViewTransitionable(props) {
  const {
    Component = Animated.View,
    children,
    style,
    externalSharedValuesRef,
    debugTransitions: debug = false,
    id,
    i,
    onTransitionableUpdate,
    transitionableUpdateMarker,
    ...restProps
  } = props;

  const internalSharedValuesRef = useSharedValue({});

  const prevTransitionConfigRef = useRef({});
  const prevTransitionConfig = prevTransitionConfigRef.current;

  const prevFlatStyleRef = useRef({});
  const prevFlatStyle = prevFlatStyleRef.current;

  const stylesArray = Array.isArray(style) ? style : [style];
  const { flatStyle, externalAnimatedStyles } = useMemo(
    () => createFlatStyleKit(stylesArray),
    [style],
  );

  const transitionKit = useMemo(
    () => createTransitionKit(
      flatStyle,
      prevFlatStyle,
      prevTransitionConfig,
      internalSharedValuesRef,
      externalSharedValuesRef,
      debug,
      id,
      i,
    ),
    [
      flatStyle,
      prevFlatStyle,
      prevTransitionConfig,
      internalSharedValuesRef,
      externalSharedValuesRef,
      debug,
      id,
      i,
    ],
  );

  const handleTransitionEnd = (isFinished) => {
    const { onTransitionEnd, id, i } = props;

    if (!isFinished) {
      console.warn('not finished', { id, i });
      return;
    }

    debug && console.log('+++ ]]] handleEnd', id, i);

    if (onTransitionEnd) {
      onTransitionEnd(isFinished);
    }
  };

  const handleNoTransitionEnd = () => {
    debug && console.log('handleNoTransitionEnd');
    if (onTransitionableUpdate) {
      onTransitionableUpdate(transitionableUpdateMarker);
    }
  };

  const {
    staticStyle,
    transitionConfig,
    sharedValues,
  } = transitionKit;

  internalSharedValuesRef.value = sharedValues;

  useEffect(() => {
    prevTransitionConfigRef.current = transitionConfig;
    prevFlatStyleRef.current = flatStyle;
  });


  useEffect(() => {
    if (transitionConfig && Object.keys(transitionConfig).length) {
      runOnUI(updateSharedValues)(
        internalSharedValuesRef,
        externalSharedValuesRef,
        transitionConfig,
        debug,
        id, i,
      );
    }
  });

  const transitionKeys = Object.keys(transitionConfig);

  const transitionStyle = useAnimatedStyle(() => {
    let longestTransitionName = '';
    let longestDuration = 0;

    transitionKeys.forEach(name => {
      const { duration } = transitionConfig[name];

      if (duration >= longestDuration) {
        longestTransitionName = name;
        longestDuration = duration;
      }
    });

    const animatedStyle = transitionKeys.reduce((acc, name) => {
      const result = {};
      const value = extractValue(name, internalSharedValuesRef, externalSharedValuesRef);

      if (value === undefined) {
        debug && console.log('+++ undefined value', id, i, name);
        return acc;
      }

      const easing = timingFunctions[transitionConfig[name].timingFunction];
      const { duration, from, to } = transitionConfig[name];
      const isTransition = !(from === undefined || from === to) && value === to;
      const withCallback = isTransition && name === longestTransitionName;
      const endCallBack = withCallback ? runOnJS(handleTransitionEnd) : runOnJS(handleNoTransitionEnd);

      const styleValue = isTransition ? withTiming(value, { easing, duration }, endCallBack) : value;

      if (!isTransition) {
        endCallBack();
      }

      if (transformStyleProps[name] === null) {
        result.transform ??= [];
        result.transform.push({ [name]: styleValue });
      } else {
        result[name] = styleValue;
      }

      return Object.assign({}, acc, result);
    }, {});

    debug && console.log('+++ +++ animatedStyle', id, i, animatedStyle);

    return animatedStyle;
  });

  const finalStyles = [
    staticStyle,
    ...(transitionStyle ? [transitionStyle] : []),
    ...(externalAnimatedStyles ? externalAnimatedStyles : []),
  ];

  debug && console.log('+++ + staticStyle', id, i, staticStyle, { transitionConfig });

  return (
    <Component
      style={finalStyles}
      {...restProps}
    >
      {children}
    </Component>
  )
}