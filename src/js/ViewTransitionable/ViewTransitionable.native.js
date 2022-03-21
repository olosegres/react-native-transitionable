import React from 'react';
import { Animated } from 'react-native';
import { mergeStyles } from '../../../../react-style-utils/concatStyles';
import ViewAnimateable from '../ViewAnimateable';
import {
  nativeAnimationTransitionNames,
  numericPropNames,
  postfixedTransitionsConfig,
  transformStyleProps,
} from './constants.mjs';
import timingFunctions from './timingFunctions';

const debug = false;

function mbArrayToArray(mbArray) {
  return Array.isArray(mbArray) ? mbArray : [...(mbArray ? [mbArray] : [])];
}

function getAnimationInProgress(animatedObject) {
  if (animatedObject instanceof Animated.Interpolation) {
    return animatedObject?._parent?._animation;
  } else if (animatedObject instanceof Animated.Value) {
    return animatedObject._animation;
  }
}

function createAnimatedValue(transitionName, startStyleValue, finalStyleValue) {

  if (typeof startStyleValue === 'number' && isNaN(startStyleValue)) {
    debugger
    throw new Error('startStyleValue is NaN');
  } else if (typeof finalStyleValue === 'number' && isNaN(finalStyleValue)) {
    debugger
    throw new Error('finalStyleValue is NaN');
  }

  if (typeof startStyleValue === 'undefined' || startStyleValue === null) {
    return;
  }

  if (typeof startStyleValue === 'string') {
    const startAnimatedValue = startStyleValue === finalStyleValue ? 1 : 0;

    const animatedObject = new Animated.Value(startAnimatedValue);
    return animatedObject.interpolate({
      inputRange: [0, 1],
      outputRange: [startStyleValue, finalStyleValue]
    });
  }

  return new Animated.Value(startStyleValue);
}

export function hash(object) {
  return object ? JSON.stringify(object) : '';
}

type TTimingFunctions = $Keys<timingFunctions>;

type TPropertyConfig = {
  [propertyName: string]: {
    timingFunction: TTimingFunctions,
    duration: number,
    delay?: number,
  }
};

function getStartValue(propertyName, styleValue, prevStyleValue) {

  if (typeof prevStyleValue !== 'undefined') {
    return prevStyleValue;
  }

  if (typeof styleValue !== 'undefined') {
    return styleValue;
  }

  // actually shuld not be called without defined styleValue || prevStyleValue

  debugger

  if (propertyName in numericPropNames) {
    return 0;
  }

  if (propertyName === 'opacity') {
    return 1;
  }

  debugger
}

function getPrevValue(transitionName, prevFlatStyle) {
  if (!prevFlatStyle) {
    return;
  }

  if (transitionName in transformStyleProps) {
    const prevTransformConfig = prevFlatStyle?.transform?.find(tr => transitionName in tr);
    if (!prevTransformConfig) {
      return;
    }

    if (prevTransformConfig[transitionName] instanceof Animated.Interpolation) {
      const value = prevTransformConfig[transitionName];
      return value._interpolation(value._parent._value);
    }

    return prevTransformConfig[transitionName];
  }

  return prevFlatStyle[transitionName];
}

function createStyleConfig({
  transitionName,
  prevStyleValue: prevStyleValueRaw,
  styleValue,
  animatedObjects,
  prevTransitionProps,
  id,
  i,
}) {

  let prevStyleValue = prevStyleValueRaw;

  if (prevStyleValueRaw instanceof Animated.Interpolation) {
    prevStyleValue = prevStyleValue._interpolation(prevStyleValue._parent._value);
  }

  let animatedObject = animatedObjects[transitionName];

  if (
    styleValue instanceof Animated.Interpolation
    ||
    styleValue instanceof Animated.Value
  ) {
    return { finalStyleValue: styleValue, isTransitionable: false };
  }

  if (!animatedObject) { // creating animatedObject
    const startValue = getStartValue(transitionName, styleValue, prevStyleValue);

    debug && console.log('createStyleConfig create animatedObject', id, i, transitionName, { startValue, styleValue });
    const animatedObject = createAnimatedValue(transitionName, startValue, styleValue);
    animatedObjects[transitionName] = animatedObject;

    let animatedToValue = styleValue;
    if (animatedObject instanceof Animated.Interpolation) {
      animatedToValue = 1;
    }
    return { finalStyleValue: animatedObject || styleValue, isTransitionable: startValue !== styleValue, animatedToValue };
  }

  if (typeof styleValue === 'undefined') {
    debug && console.log('createStyleConfig styleValue is undefined', id, i, { transitionName });
    return { isTransitionable: false };
  }

  // todo handle not actual value inside Animated
  // TODO if (styleValue === prevStyleValue && animatedInnerValue !== styleValue) { setValue(styleValue) } (become transitionable but withot styleValue change)

  let animationInProgress = null;
  let animatedObjectValue;
  let animationToValue;
  let withInterpolation = false;

  if (animatedObject instanceof Animated.Interpolation) {
    animatedObjectValue = animatedObject._parent._value;
    animationInProgress = animatedObject._parent._animation;

    animationToValue = animationInProgress ? (
        animatedObject._config.outputRange[
          animatedObject._config.inputRange.findIndex(input => input === animationInProgress._toValue)
        ]
    ) : undefined;

    withInterpolation = true;

  } else if (animatedObject instanceof Animated.Value) {
    animatedObjectValue = animatedObject._value;
    animationInProgress = animatedObject._animation;

    animationToValue = animationInProgress?._toValue;

  } else {
    debugger
  }

  if (
    typeof prevStyleValue === 'undefined'
  ) { // styleValue can not be transitioned
    debug && console.log('createStyleConfig prevStyleValue is undefined', id, i, { transitionName, styleValue });
    return { finalStyleValue: styleValue, isTransitionable: false };
  }

  const isTransitionable = (
    transitionName in prevTransitionProps // to be compatible with web behaviour (no animation if prop was not transitionable)
    &&
    (
      animationInProgress && animationToValue !== styleValue // todo process interpolated
      ||
      !animationInProgress && prevStyleValue !== styleValue
    )
  );

  const isAnimationInProgressWithOutdatedValue = animationInProgress && animationToValue !== styleValue;
  const isAnimatedObjectWithPrevValue = animatedObjectValue === prevStyleValue;

  if (styleValue !== prevStyleValue && isAnimationInProgressWithOutdatedValue) {
    debug && console.log('createStyleConfig styleValues chenged while animation in progress', id, i, { transitionName, animationToValue, styleValue, prevStyleValue });

    if (withInterpolation) {
      const newAnimatedObject = animatedObject._parent.interpolate({
        inputRange: [0, 1],
        outputRange: [animationToValue, styleValue]
      });

      debug && console.log('updated interpolation', id, newAnimatedObject);
      if (!newAnimatedObject._parent.setValue) {
        debugger
      }
      newAnimatedObject._parent.setValue(0);
      animatedObjects[transitionName] = newAnimatedObject;
      return { finalStyleValue: newAnimatedObject, isTransitionable, animatedToValue: 1 };
    }

    return { finalStyleValue: animatedObject, isTransitionable, animatedToValue: styleValue };
  }

  if (!isAnimatedObjectWithPrevValue && !animationInProgress) {
    debug && console.log('createStyleConfig animatedObject with outdated styleValue', id, i, { transitionName, animatedObjectValue, styleValue, prevStyleValue });

    if (withInterpolation) {
      const newAnimatedObject = animatedObject._parent.interpolate({
        inputRange: [0, 1],
        outputRange: [prevStyleValue, styleValue]
      });
      if (!newAnimatedObject._parent.setValue) {
        debugger
      }
      newAnimatedObject._parent.setValue(0);
      animatedObjects[transitionName] = newAnimatedObject;
      debug && console.log('updated interpolation', id, newAnimatedObject);
      return { finalStyleValue: newAnimatedObject, isTransitionable, animatedToValue: 1 };
    }

    animatedObject.setValue(prevStyleValue);
    return { finalStyleValue: animatedObject, isTransitionable, animatedToValue: styleValue };
  }

  debug && console.log('createStyleConfig fallback return', id, i, { transitionName, animationInProgress, animatedObjectValue, styleValue, prevStyleValue });

  let animatedToValue = styleValue;
  if (animatedObject instanceof Animated.Interpolation) {
    animatedToValue = 1;
  }

  return { finalStyleValue: animatedObject, isTransitionable, animatedToValue };
}

function createAnimateableConfig(props, state) {
  const { id } = props;
  const { animateableConfig, flatStyle, prevFlatStyle } = state;
  const {
    transitionTimingFunction,
    transitionProperty,
    transitionDuration,
    transitionDelay,
    transition,
    ...nativeStyle
  } = flatStyle;

  if (transition) {
    throw new Error('There is not supported shorthand property "transition" in styles');
  }

  const transitionPropertyArray = mbArrayToArray(transitionProperty);
  const { animatedObjects } = animateableConfig;

  if (!transitionPropertyArray.length) {
    return { style: nativeStyle, animatedObjects };
  }

  const transitionTimingFunctionArray = mbArrayToArray(transitionTimingFunction);
  const transitionDurationArray = mbArrayToArray(transitionDuration);
  const transitionDelayArray = mbArrayToArray(transitionDelay);

  const prevTransitionProps = animateableConfig?.transitionProps || {};

  if (!animatedObjects) {
    debugger
  }

  const style = {
    ...nativeStyle,
  };

  const transitionConfig: TPropertyConfig = {};
  const transitionProps = {};

  for (let i = 0; i < transitionPropertyArray.length; i++) {
    const transitionPropertyName = transitionPropertyArray[i];

    const timingFunction = Array.isArray(transitionTimingFunction) ? transitionTimingFunctionArray[i] : transitionTimingFunction;
    const duration = Array.isArray(transitionDuration) ? transitionDurationArray[i] : transitionDuration;
    const delay = Array.isArray(transitionDelay) ? transitionDelayArray[i]: transitionDelay;

    if (transitionPropertyName === 'transform') {

      if (flatStyle.transform) {
        style.transform = [];

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

          const prevStyleValue = getPrevValue(transitionName, prevFlatStyle);
          const { finalStyleValue, isTransitionable, animatedToValue } = createStyleConfig({ /// reset interpolated to 0 if should transition after
            transitionName,
            styleValue,
            prevStyleValue,
            animatedObjects,
            prevTransitionProps,
            id,
            i,
          });

          style.transform.push({ [transitionName]: finalStyleValue });

          transitionProps[transitionName] = true;

          if (isTransitionable) {
            transitionConfig[transitionName] = {
              animatedToValue,
              timingFunction,
              duration,
              delay,
            };
          }
        }
      }

    } else if (transitionPropertyName in postfixedTransitionsConfig) {
      const possibleTransitionProperties = postfixedTransitionsConfig[transitionPropertyName];

      for (let postfixedPropertyName of possibleTransitionProperties) {
        if (!(postfixedPropertyName in flatStyle)) {
          continue;
        }

        const styleValue = flatStyle[postfixedPropertyName];
        const prevStyleValue = getPrevValue(postfixedPropertyName, prevFlatStyle);

        const { finalStyleValue, isTransitionable, animatedToValue } = createStyleConfig({
          transitionName: postfixedPropertyName,
          styleValue,
          prevStyleValue,
          animatedObjects,
          prevTransitionProps,
          id,
          i,
        });

        style[postfixedPropertyName] = finalStyleValue;

        transitionProps[postfixedPropertyName] = true;

        if (isTransitionable) {
          transitionConfig[postfixedPropertyName] = {
            animatedToValue,
            timingFunction,
            duration,
            delay,
          };
        }
      }
    } else {
      const transitionName = transitionPropertyName;

      const styleValue = flatStyle[transitionName];

      if (typeof styleValue !== 'undefined') {

        const prevStyleValue = getPrevValue(transitionName, prevFlatStyle);
        const { finalStyleValue, isTransitionable, animatedToValue } = createStyleConfig({
          transitionName,
          prevStyleValue,
          styleValue,
          animatedObjects,
          prevTransitionProps,
          id,
          i,
        });

        style[transitionName] = finalStyleValue;

        transitionProps[transitionName] = true;

        if (isTransitionable) {
          transitionConfig[transitionName] = {
            animatedToValue,
            timingFunction,
            duration,
            delay,
          };
        }

      }

    }
  }

  debug && console.log('createAnimateableConfig', props.id, { transitionPropertyArray, transitionConfig, animatedObjects });

  return { animatedObjects, style, transitionConfig, transitionProps };
}

type TProps = {

};

export default class ViewTransitionable extends React.PureComponent<TProps> {

  static defaultProps = {
    Component: ViewAnimateable,
  };

  static getDerivedStateFromProps(props, state) {
    const { prevStyle, animateableConfig } = state;

    const derived = {};

    let { flatStyle, prevFlatStyle } = state;

    if (props.style !== prevStyle) {
      derived.flatStyle = Array.isArray(props.style) ? mergeStyles(...props.style) : props.style;
      derived.prevFlatStyle = state.flatStyle;
      derived.prevStyle = props.style;

      flatStyle = derived.flatStyle;
      prevFlatStyle = derived.prevFlatStyle;
    }

    if (!flatStyle && !animateableConfig.style) {
      return null;
    }

    // todo optimize if !flatStyle.transitionProperty

    if (
      flatStyle.transitionProperty?.toString() !== prevFlatStyle?.transitionProperty?.toString()
      ||
      state.flatStyle !== flatStyle
    ) {
      derived.animateableConfig = createAnimateableConfig(props, { ...state, ...derived }); // passing derived need for flatStyle to be updated
    }

    if (Object.keys(derived).length) {
      return derived;
    }

    return null;
  }

  state = {
    animateableConfig: {
      transitionConfig: {},
      animatedObjects: {},
      style: null,
    },
    flatStyle: null,
    prevFlatStyle: null,
    prevStyle: null,
  };

  handleTransitionEnd = () => {
    const { onTransitionEnd, id, i } = this.props;

    debug && console.log('handleTransitionEnd', id, i);

    if (onTransitionEnd) {
      onTransitionEnd();
    }
  };

  animateTransitionable() {
    const { i, id } = this.props;
    const { animateableConfig } = this.state;
    const { transitionConfig, animatedObjects } = animateableConfig;

    if (!transitionConfig) {
      return;
    }

    const transitionableNames = Object.keys(transitionConfig);

    let useNativeDriver = true;
    let longestTransitionName = '';
    let longestDuration = 0;

    for (let name of transitionableNames) {
      if (!(name in nativeAnimationTransitionNames)) {
        useNativeDriver = false;
      }

      const { duration } = transitionConfig[name];

      if (duration >= longestDuration) {
        longestTransitionName = name;
        longestDuration = duration;
      }
    }

    for (let name of transitionableNames) {
      const {
        timingFunction,
        duration,
        delay,
        animatedToValue,
      } = transitionConfig[name];

      const animatedObject = animatedObjects[name];

      debug && console.log('transition START', id, i, name, {
        from: animatedObject instanceof Animated.Interpolation ? animatedObject._parent._value : animatedObject._value,
        to: animatedToValue,
        duration,
      }, animatedObject);

      if (!timingFunction || !timingFunctions[timingFunction]) {
        debugger
      }

      let animatedValue = animatedObject;

      if (animatedObject instanceof Animated.Interpolation) {
        animatedValue = animatedObject._parent;
      }

      // todo enable only if all values support native animation (name in nativeAnimationTransitionNames does not correct work)

      Animated.timing(animatedValue, {
        toValue: animatedToValue,
        duration: duration,
        delay: delay || 0,
        easing: timingFunctions[timingFunction],
        useNativeDriver,
      }).start(() => {
        if (getAnimationInProgress(animatedObject)) {
          debug && console.log('transition END-EXIT, animation still in progress', this.id, { name, animatedObject });
          return;
        }

        if (name === longestTransitionName) {
          debug && console.log('transition END-call', this.id, { name, animatedToValue });
          this.handleTransitionEnd({ name, value: animatedToValue });
        }
      });
    }
  }

  componentDidMount() {
    this.animateTransitionable();
  }

  componentDidUpdate(prevProps, prevState) {
    const { onTransitionableUpdate } = this.props;

    if (onTransitionableUpdate) {
      const { transitionableUpdateMarker } = this.props;
      onTransitionableUpdate(transitionableUpdateMarker);
    }

    const { animateableConfig } = this.state;
    if (animateableConfig && animateableConfig !== prevState.animateableConfig) {
      this.animateTransitionable();
    }
  }

  render() {
    const { animateableConfig } = this.state;

    return (
      <ViewAnimateable
        {...this.props}
        style={animateableConfig.style}
      />
    );
  }
}
