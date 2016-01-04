import $ from 'jQuery';
import asScrollbar from '../libs/jquery.asScrollbar.test';

const NAME = 'asScrollable';

const DEFAULT = {
	namespace: 'asScrollable',

	skin: null,

	contentSelector: null,
	containerSelector: null,

	enabledClass: 'is-enabled',
	disabledClass: 'is-disabled',

	draggingClass: 'is-dragging',
	hoveringClass: 'is-hovering',
	scrollingClass: 'is-scrolling',

	direction: 'vertical', // vertical, horizontal, both, auto

	showOnHover: true,
	showOnBarHover: false,

	duration: 500,
	easing: 'ease-in', // linear, ease, ease-in, ease-out, ease-in-out

	responsive: true,
	throttle: 20,

	scrollbar: {}
}

let instanceId = 0;

/**
 * Helper functions
 **/
let getTime = () => {
	if (typeof window.performance !== 'undefined' && window.performance.now) {
		return window.performance.now();
	} else {
		return Date.now();
	}
}

let isPercentage = (n) => {
	return typeof n === 'string' && n.indexOf('%') != -1;
}

let conventToPercentage = (n) => {
	if (n < 0) {
		n = 0;
	} else if (n > 1) {
		n = 1;
	}
	return parseFloat(n).toFixed(4) * 100 + '%';
}

let convertPercentageToFloat = (n) => {
	return parseFloat(n.slice(0, -1) / 100, 10);
}

let isFFLionScrollbar = (() => {
	let isOSXFF, ua, version;
	ua = window.navigator.userAgent;
	isOSXFF = /(?=.+Mac OS X)(?=.+Firefox)/.test(ua);
	if (!isOSXFF) {
		return false;
	}
	version = /Firefox\/\d{2}\./.exec(ua);
	if (version) {
		version = version[0].replace(/\D+/g, '');
	}
	return isOSXFF && +version > 23;
})();

class asScrollable {
	constructor(options, element) {
		this.$element = $(element);
		options = this.options = $.extend({}, DEFAULT, options || {}, this.$element.data('options') || {});

		this.classes = {
			wrap: options.namespace,
			content: options.namespace + '-content',
			container: options.namespace + '-container',
			bar: options.namespace + '-bar',
			barHide: options.namespace + '-bar-hide',
			skin: options.skin
		};

		this.attributes = {
			vertical: {
				axis: 'Y',
				overflow: 'overflow-y',

				scroll: 'scrollTop',
				scrollLength: 'scrollHeight',
				pageOffset: 'pageYOffset',

				ffPadding: 'padding-right',

				length: 'height',
				clientLength: 'clientHeight',
				offset: 'offsetHeight',

				crossLength: 'width',
				crossClientLength: 'clientWidth',
				crossOffset: 'offsetWidth'
			},
			horizontal: {
				axis: 'X',
				overflow: 'overflow-x',

				scroll: 'scrollLeft',
				scrollLength: 'scrollWidth',
				pageOffset: 'pageXOffset',

				ffPadding: 'padding-bottom',

				length: 'width',
				clientLength: 'clientWidth',
				offset: 'offsetWidth',

				crossLength: 'height',
				crossClientLength: 'clientHeight',
				crossOffset: 'offsetHeight'
			}
		};

		// Current state information.
		this._states = {};

		// Supported direction
		this.horizontal = null;
		this.vertical = null;

		this.$bar = null;

		// Current timeout
		this._frameId = null;
		this._timeoutId = null;

		this.instanceId = (++instanceId);

		this.easing = asScrollbar.easing[this.options.easing] || asScrollbar.easing.ease;

		let position = this.$element.css('position');
		if (this.options.containerSelector) {
			this.$container = this.$element.find(this.options.containerSelector);
			this.$wrap = this.$element;

			if (position == 'static') {
				this.$wrap.css('position', 'relative');
			}
		} else {
			this.$container = this.$element.wrap('<div>');
			this.$wrap = this.$container.parent();
			this.$wrap.height(this.$element.height());

			if (position !== 'static') {
				this.$wrap.css('position', position);
			} else {
				this.$wrap.css('position', 'relative');
			}
		}

		if (this.options.contentSelector) {
			this.$content = this.$container.find(this.options.contentSelector);
		} else {
			this.$content = this.$container.wrap('<div>');
			this.$container = this.$content.parent();
		}

		this.init();
	}

	init() {
		switch (this.options.direction) {
		case 'vertical':
			this.vertical = true;
			break;
		case 'horizontal':
			this.horizontal = true;
			break;
		case 'both':
			this.horizontal = true;
			this.vertical = true;
			break;
		case 'auto':
			let overflowX = this.$element.css('overflow-x'),
				overflowY = this.$element.css('overflow-y');

			if (overflowX === 'scroll' || overflowX === 'auto') {
				this.horizontal = true;
			}
			if (overflowY === 'scroll' || overflowY === 'auto') {
				this.vertical = true;
			}
			break;
		}

		if (!this.vertical && !this.horizontal) {
			return;
		}

		this.$wrap.addClass(this.classes.wrap);
		this.$container.addClass(this.classes.container);
		this.$content.addClass(this.classes.content);

		if (this.options.skin) {
			this.$wrap.addClass(this.classes.skin);
		}

		this.$wrap.addClass(this.options.enabledClass);

		if (this.vertical) {
			this.$wrap.addClass(this.classes.wrap + '-vertical');
			this.initLayout('vertical');
			this.createBar('vertical');
		}

		if (this.horizontal) {
			this.$wrap.addClass(this.classes.wrap + '-horizontal');
			this.initLayout('horizontal');
			this.createBar('horizontal');
		}

		this.bindEvents();
	}

	bindEvents() {
		let self = this;
		if (this.options.responsive) {
			$(window).on(this.eventNameWithId('orientationchange'), () => {
				this.update();
			});
			$(window).on(this.eventNameWithId('resize'), this.throttle(() => {
				this.update();
			}, this.options.throttle));
		}

		if (!this.horizontal && !this.vertical) {
			return;
		}

		this.$wrap.on(this.eventName('mouseenter'), () => {
			this.$wrap.addClass(this.options.hoveringClass);
			this.enter('hovering');
			this.trigger('hover');
		});

		this.$wrap.on(this.eventName('mouseleave'), () => {
			this.$wrap.removeClass(this.options.hoveringClass);

			if (!this.is('hovering')) {
				return;
			}
			this.leave('hovering');
			this.trigger('hovered');
		});
		//======>>>>>self<<<<<<<=======
		if (this.options.showOnHover) {
			if (this.options.showOnBarHover) {
				this.$bar.on('asScrollbar::hover', function () {
					self.showBar(this.direction);
				}).on('asScrollbar::hovered', function () {
					self.hideBar(this.direction);
				});
			} else {
				this.$element.on(NAME + '::hover', $.proxy(this.showBar, this));
				this.$element.on(NAME + '::hovered', $.proxy(this.hideBar, this));
			}
		}
		//======>>>>>end self<<<<<<<=======

		this.$container.on(this.eventName('scroll'), () => {
			if (this.horizontal) {
				let oldLeft = this.offsetLeft;
				this.offsetLeft = this.getOffset('horizontal');

				if (oldLeft !== this.offsetLeft) {
					this.trigger('scroll', this.getPercentOffset('horizontal'), 'horizontal');

					if (this.offsetLeft === 0) {
						this.trigger('scrolltop', 'horizontal');
					}
					if (this.offsetLeft === this.getScrollLength('horizontal')) {
						this.trigger('scrollend', 'horizontal');
					}
				}
			}

			if (this.vertical) {
				let oldTop = this.offsetTop;

				this.offsetTop = this.getOffset('vertical');

				if (oldTop !== this.offsetTop) {
					this.trigger('scroll', this.getPercentOffset('vertical'), 'vertical');

					if (this.offsetTop === 0) {
						this.trigger('scrolltop', 'vertical');
					}
					if (this.offsetTop === this.getScrollLength('vertical')) {
						this.trigger('scrollend', 'vertical');
					}
				}
			}
		});

		this.$element.on(NAME + '::scroll', (e, api, value, direction) => {
			if (!this.is('scrolling')) {
				this.enter('scrolling');
				this.$wrap.addClass(this.options.scrollingClass);
			}
			let bar = api.getBarApi(direction);

			bar.moveTo(conventToPercentage(value), false, true);

			clearTimeout(this._timeoutId);
			this._timeoutId = setTimeout(() => {
				this.$wrap.removeClass(this.options.scrollingClass);
				this.leave('scrolling');
			}, 200);
		});

		this.$bar.on('asScrollbar::change', function (e, api, value) {
			self.scrollTo(this.direction, conventToPercentage(value), false, true);
		});

		this.$bar.on('asScrollbar::drag', () => {
			this.$wrap.addClass(this.options.draggingClass);
		}).on('asScrollbar::dragged', () => {
			this.$wrap.removeClass(this.options.draggingClass);
		});
	}

	unbindEvents() {
		this.$wrap.off(this.eventName());
		this.$element.off(NAME + '::scroll').off(NAME + '::hover').off(NAME + '::hovered');
		this.$container.off(this.eventName());
		$(window).off(this.eventNameWithId());
	}

	initLayout(direction) {
		if (direction === 'vertical') {
			this.$container.css('height', this.$wrap.height());
		}
		let attributes = this.attributes[direction],
			container = this.$container[0];

		// this.$container.css(attributes.overflow, 'scroll');

		let scrollbarWidth = this.getBrowserScrollbarWidth(direction),
			parentLength = container.parentNode[attributes.crossClientLength];

		this.$content.css(attributes.crossLength, parentLength + 'px');
		this.$container.css(attributes.crossLength, scrollbarWidth + parentLength + 'px');

		if (scrollbarWidth === 0 && isFFLionScrollbar) {
			this.$container.css(attributes.ffPadding, 16);
		}
	}

	createBar(direction) {
		let options = $.extend(this.options.scrollbar, {
			namespace: this.classes.bar,
			direction: direction,
			useCssTransitions: false,
			keyboard: false
				//mousewheel: false
		});
		let $bar = $('<div>');
		$bar.asScrollbar(options);

		if (this.options.showOnHover) {
			$bar.addClass(this.classes.barHide);
		}

		$bar.appendTo(this.$wrap);

		this['$' + direction] = $bar;

		if (this.$bar === null) {
			this.$bar = $bar;
		} else {
			this.$bar = this.$bar.add($bar);
		}

		this.updateBarHandle(direction);
	}

	trigger(eventType, ...params) {
		let data = [this].concat(params);

		// event
		this.$element.trigger(NAME + '::' + eventType, data);

		// callback
		eventType = eventType.replace(/\b\w+\b/g, (word) => {
			return word.substring(0, 1).toUpperCase() + word.substring(1);
		});
		let onFunction = 'on' + eventType;

		if (typeof this.options[onFunction] === 'function') {
			this.options[onFunction].apply(this, params);
		}
	}

	/**
	 * Checks whether the carousel is in a specific state or not.
	 */
	is(state) {
		return this._states[state] && this._states[state] > 0;
	}

	/**
	 * Enters a state.
	 */
	enter(state) {
		if (this._states[state] === undefined) {
			this._states[state] = 0;
		}

		this._states[state]++;
	}

	/**
	 * Leaves a state.
	 */
	leave(state) {
		this._states[state]--;
	}

	eventName(events) {
		if (typeof events !== 'string' || events === '') {
			return '.' + this.options.namespace;
		}

		events = events.split(' ');
		let length = events.length;
		for (let i = 0; i < length; i++) {
			events[i] = events[i] + '.' + this.options.namespace;
		}
		return events.join(' ');
	}

	eventNameWithId(events) {
		if (typeof events !== 'string' || events === '') {
			return this.options.namespace + '-' + this.instanceId;
		}

		events = events.split(' ');
		let length = events.length;
		for (let i = 0; i < length; i++) {
			events[i] = events[i] + '.' + this.options.namespace + '-' + this.instanceId;
		}
		return events.join(' ');
	}

	/**
	 * _throttle
	 * @description Borrowed from Underscore.js
	 */
	throttle(func, wait) {
		let _now = Date.now || function () {
			return new Date().getTime();
		};
		let context, args, result;
		let timeout = null;
		let previous = 0;
		let later = function () {
			previous = _now();
			timeout = null;
			result = func.apply(context, args);
			context = args = null;
		};
		return function () {
			let now = _now();
			let remaining = wait - (now - previous);
			context = this;
			args = arguments;
			if (remaining <= 0) {
				clearTimeout(timeout);
				timeout = null;
				previous = now;
				result = func.apply(context, args);
				context = args = null;
			} else if (!timeout) {
				timeout = setTimeout(later, remaining);
			}
			return result;
		};
	}

	getBrowserScrollbarWidth(direction) {
		let attributes = this.attributes[direction],
			outer, outerStyle;
		if (attributes.scrollbarWidth) {
			return attributes.scrollbarWidth;
		}
		outer = document.createElement('div');
		outerStyle = outer.style;
		outerStyle.position = 'absolute';
		outerStyle.width = '100px';
		outerStyle.height = '100px';
		outerStyle.overflow = 'scroll';
		outerStyle.top = '-9999px';
		document.body.appendChild(outer);
		attributes.scrollbarWidth = outer[attributes.offset] - outer[attributes.clientLength];
		document.body.removeChild(outer);
		return attributes.scrollbarWidth;
	}

	getOffset(direction) {
		let attributes = this.attributes[direction],
			container = this.$container[0];

		return (container[attributes.pageOffset] || container[attributes.scroll]);
	}

	getPercentOffset(direction) {
		return this.getOffset(direction) / this.getScrollLength(direction);
	}

	getContainerLength(direction) {
		return this.$container[0][this.attributes[direction].clientLength];
	}

	getScrollLength(direction) {
		let scrollLength = this.$content[0][this.attributes[direction].scrollLength];
		return scrollLength - this.getContainerLength(direction);
	}

	scrollTo(direction, value, trigger, sync) {
		let type = typeof value;

		if (type === "string") {
			if (isPercentage(value)) {
				value = convertPercentageToFloat(value) * this.getScrollLength(direction);
			}

			value = parseFloat(value);
			type = "number";
		}

		if (type !== "number") {
			return;
		}

		this.move(direction, value, trigger, sync);
	}

	scrollBy(direction, value, trigger, sync) {
		let type = typeof value;

		if (type === "string") {
			if (isPercentage(value)) {
				value = convertPercentageToFloat(value) * this.getScrollLength(direction);
			}

			value = parseFloat(value);
			type = "number";
		}

		if (type !== "number") {
			return;
		}

		this.move(direction, this.getOffset(direction) + value, trigger, sync);
	}

	move(direction, value, trigger, sync) {
		if (this[direction] !== true || typeof value !== "number") {
			return;
		}

		this.enter('moving');

		if (value < 0) {
			value = 0;
		} else if (value > this.getScrollLength(direction)) {
			value = this.getScrollLength(direction);
		}

		let attributes = this.attributes[direction];

		let callback = () => {
			this.leave('moving');
		}

		if (sync) {
			this.$container[0][attributes.scroll] = value;

			if (trigger !== false) {
				this.trigger('change', value / this.getScrollLength(direction));
			}
			callback();
		} else {
			this.enter('animating');
			let startTime = getTime();
			let start = this.getOffset(direction);
			let end = value;

			let run = (time) => {
				let percent = (time - startTime) / this.options.duration;

				if (percent > 1) {
					percent = 1;
				}

				percent = this.easing.fn(percent);

				let current = parseFloat(start + percent * (end - start), 10);
				this.$container[0][attributes.scroll] = current;

				if (trigger !== false) {
					this.trigger('change', value / this.getScrollLength(direction));
				}

				if (percent === 1) {
					window.cancelAnimationFrame(this._frameId);
					this._frameId = null;

					this.leave('animating');
					callback();
				} else {
					this._frameId = window.requestAnimationFrame(run);
				}
			};

			this._frameId = window.requestAnimationFrame(run);
		}
	}

	scrollXto(value, trigger, sync) {
		return this.scrollTo('horizontal', value, trigger, sync);
	}

	scrollYto(value, trigger, sync) {
		return this.scrollTo('vertical', value, trigger, sync);
	}

	scrollXby(value, trigger, sync) {
		return this.scrollBy('horizontal', value, trigger, sync);
	}

	scrollYby(value, trigger, sync) {
		return this.scrollBy('vertical', value, trigger, sync);
	}

	getBar(direction) {
		if (direction && this['$' + direction]) {
			return this['$' + direction];
		} else {
			return this.$bar;
		}
	}

	getBarApi(direction) {
		return this.getBar(direction).data('asScrollbar');
	}

	getBarX() {
		return this.getBar('horizontal');
	}

	getBarY() {
		return this.getBar('vertical');
	}

	showBar(direction) {
		this.getBar(direction).removeClass(this.classes.barHide);
	}

	hideBar(direction) {
		this.getBar(direction).addClass(this.classes.barHide);
	}

	updateBarHandle(direction) {
		let api = this.getBarApi(direction);

		if (!api) {
			return;
		}

		let scrollLength = this.getScrollLength(direction),
			containerLength = this.getContainerLength(direction);

		if (scrollLength > 0) {
			if (api.is('disabled')) {
				api.enable();
			}
			api.setHandleLength(api.getBarLength() * containerLength / (scrollLength + containerLength), true);
		} else {
			api.disable();
		}
	}

	disable() {
		if (!this.is('disabled')) {
			this.enter('disabled');
			this.$wrap.addClass(this.options.disabledClass).removeClass(this.options.enabledClass);

			this.unbindEvents();
			this.unStyle();
		}
	}

	enable() {
		if (this.is('disabled')) {
			this.leave('disabled');
			this.$wrap.addClass(this.options.enabledClass).removeClass(this.options.disabledClass);

			this.bindEvents();
			this.update();
		}
	}

	update() {
		if (this.is('disabled')) {
			return;
		}
		if (this.vertical) {
			this.initLayout('vertical');
			this.updateBarHandle('vertical');
		}
		if (this.horizontal) {
			this.initLayout('horizontal');
			this.updateBarHandle('horizontal');
		}
	}

	unStyle() {
		if (this.horizontal) {
			this.$container.css({
				'height': '',
				'padding-bottom': ''
			});
			this.$content.css({
				'height': ''
			});
		}
		if (this.vertical) {
			this.$container.css({
				'width': '',
				'height': '',
				'padding-right': ''
			});
			this.$content.css({
				'width': ''
			});
		}
		if (!this.options.containerSelector) {
			this.$wrap.css({
				'height': ''
			});
		}
	}

	destory() {
		this.$wrap.removeClass(this.classes.wrap + '-vertical')
			.removeClass(this.classes.wrap + '-horizontal')
			.removeClass(this.classes.wrap)
			.removeClass(this.options.enabledClass)
			.removeClass(this.classes.disabledClass);
		this.unStyle();

		if (this.$bar) {
			this.$bar.remove();
		}

		this.unbindEvents();

		if (this.options.containerSelector) {
			this.$container.removeClass(this.classes.container);
		} else {
			this.$container.unwrap();
		}
		if (!this.options.contentSelector) {
			this.$content.unwrap();
		}
		this.$content.removeClass(this.classes.content);
		this.$element.data(NAME, null);
	}

	static _jQueryInterface(options, ...params) {
		"use strict"

		if (typeof options === 'string') {
			let method = options;

			if (/^\_/.test(method)) {
				return false;
			} else if ((/^(get)/.test(method))) {
				let api = this.first().data(NAME);
				if (api && typeof api[method] === 'function') {
					return api[method].apply(api, params);
				}
			} else {
				return this.each(function () {
					let api = $.data(this, NAME);
					if (api && typeof api[method] === 'function') {
						api[method].apply(api, params);
					}
				});
			}
		} else {
			return this.each(function () {
				if (!$(this).data(NAME)) {
					$(this).data(NAME, new asScrollable(options, this));
				} else {
					$(this).data(NAME).update();
				}
			});
		}
		return this;
	}

}

$.fn[NAME] = asScrollable._jQueryInterface;
$.fn[NAME].constructor = asScrollable;
$.fn[NAME].noConflict = () => {
	$.fn[NAME] = JQUERY_NO_CONFLICT
	return asScrollable._jQueryInterface
};

export default asScrollable;
