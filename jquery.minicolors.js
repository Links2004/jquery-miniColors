/*
 * jQuery MiniColors: A tiny color picker built on jQuery
 *
 * Copyright Cory LaViska for A Beautiful Site, LLC. (http://www.abeautifulsite.net/)
 *
 * Dual-licensed under the MIT and GPL Version 2 licenses
 *
*/
if(jQuery) (function($) {
	
	// Yay, MiniColors!
	$.minicolors = {
		// Default settings
		defaultSettings: {
			animationSpeed: 100,
			animationEasing: 'swing',
			change: null,
			changeDelay: 0,
			control: 'hue',
			defaultValue: '',
			hide: null,
			hideSpeed: 100,
			inline: false,
			letterCase: 'lowercase',
			opacity: false,
			position: 'default',
			show: null,
			showSpeed: 100,
			swatchPosition: 'left',
			textfield: true,
			theme: 'default',
			zoom: 1
		}
	};
	
	// Public methods
	$.extend($.fn, {
		minicolors: function(method, data) {
			
			switch(method) {
				
				// Destroy the control
				case 'destroy':
					$(this).each( function() {
						destroy($(this));
					});
					return $(this);
				
				// Hide the color picker
				case 'hide':
					hide();
					return $(this);
				
				// Get/set opacity
				case 'opacity':
					if( data === undefined ) {
						// Getter
						return $(this).attr('data-opacity');
					} else {
						// Setter
						$(this).each( function() {
							refresh($(this).attr('data-opacity', data));
						});
						return $(this);
					}
				
				// Get an RGB(A) object based on the current color/opacity
				case 'rgbObject':
					return rgbObject($(this), method === 'rgbaObject');
				
				// Get an RGB(A) string based on the current color/opacity
				case 'rgbString':
				case 'rgbaString':
					return rgbString($(this), method === 'rgbaString')
				
				// Get/set settings on the fly
				case 'settings':
					if( data === undefined ) {
						return $(this).data('minicolors-settings');
					} else {
						// Setter
						$(this).each( function() {
							var settings = $(this).data('minicolors-settings') || {};
							destroy($(this));
							$(this).minicolors($.extend(true, settings, data));
						});
						return $(this);
					}
				
				// Show the color picker
				case 'show':
					show( $(this).eq(0) );
					return $(this);
				
				// Get/set the hex color value
				case 'value':
					if( data === undefined ) {
						// Getter
						return $(this).val();
					} else {
						// Setter
						$(this).each( function() {
							refresh($(this).val(data));
						});
						return $(this);
					}
				
				// Initializes the control
				case 'create':
				default:
					if( method !== 'create' ) data = method;
					$(this).each( function() {
						init($(this), data);
					});
					return $(this);
				
			}
			
		}
	});
	
	//create HSV circle by canvas
	function HSVcircle(canvasElem, canvasCtx) {
		var imgData = canvasCtx.getImageData(0, 0, canvasElem.width, canvasElem.height);
		var pix = imgData.data;

		var centerX = canvasElem.width / 2;
		var centerY = canvasElem.height / 2;

		var circleRadius = Math.floor(Math.min(canvasElem.width, canvasElem.height) / 2) -1;

		var color = {r:0,g:0,b:0,alpha:0};
		
		for (var y = 0; y < canvasElem.height; y++) {
			for (var x = 0; x < canvasElem.width; x++) {
				var dx = x - centerX;
				var dy = y - centerY;

				var pointRadius = Math.sqrt(square(dx) + square(dy));   // Radius of the point
				var pointAngle = 180 * Math.atan2(dy, dx) / Math.PI;    // Angle of the point (in degree)

				if (pointRadius <= circleRadius+1) {
					var h = pointAngle+180;
					var s, alpha;

					if (pointRadius <= circleRadius) {
						// The point is in the circle, the saturation
						// depends on the radius of the point.
						s = pointRadius / circleRadius;
						alpha = 255;
					} else {
						// The point is out of the circle by 1 unit.
						// This is used for the "antialias" effect.
						s = 1;
						alpha = (1 - (pointRadius - circleRadius)) * 255;
					}
					
					color = hsv2rgba(h, s, 1, alpha);
					//color.setFromHSV(h, s, 1, alpha);
				} else {
					// The point is completely out of the circle.
					// This is used to draw a fully transparent pixel.
					color = {r:0,g:0,b:0,alpha:0};
				}

				var pixIdx = (y * canvasElem.width + x) * 4;

				pix[pixIdx+0] = color.r;
				pix[pixIdx+1] = color.g;
				pix[pixIdx+2] = color.b;
				pix[pixIdx+3] = color.alpha;
			}
		}

		canvasCtx.putImageData(imgData, 0, 0);
	}

	function square(n) {
		return n*n;
	}
	
	// Initialize input elements
	function init(input, settings) {
		
		var minicolors = $('<span class="minicolors" />'),
			defaultSettings = $.minicolors.defaultSettings;
		
		// Do nothing if already initialized
		if( input.data('minicolors-initialized') ) return;
		
		// Handle settings
		settings = $.extend(true, {}, defaultSettings, settings);
		
		// The wrapper
		minicolors
			.addClass('minicolors-theme-' + settings.theme)
			.addClass('minicolors-swatch-position-' + settings.swatchPosition)
			.toggleClass('minicolors-swatch-left', settings.swatchPosition === 'left')
			.toggleClass('minicolors-with-opacity', settings.opacity);
		
		// Custom positioning
		if( settings.position !== undefined ) {
			$.each(settings.position.split(' '), function() {
				minicolors.addClass('minicolors-position-' + this);
			});
		}		
		
		var html = 	'<span class="minicolors-panel minicolors-slider-' + settings.control + '">' + 
					'<span class="minicolors-slider">' + 
						'<span class="minicolors-picker"></span>' +
					'</span>' + 
					'<span class="minicolors-opacity-slider">' + 
						'<span class="minicolors-picker"></span>' +
					'</span>';
		
		var zoom = settings.zoom;
		
		if(settings.control == 'wheel') {
			html += '<canvas class="minicolors-canvas" width="'+(150*zoom)+'" height="'+(150*zoom)+'"></canvas>'; //style="zoom:'+(1/settings.zoom)+';"
			html += '<span class="minicolors-grid" style="background: none;">';					
		} else {
			html += '<span class="minicolors-grid">';
		}
		
		html += '<span class="minicolors-grid-inner"></span>' +
				'<span class="minicolors-picker"><span>'+	
				'</span></span>' +
				'</span>' +
				'</span>';
				
		// The input
		input
			.addClass('minicolors-input')
			.data('minicolors-initialized', true)
			.data('minicolors-settings', settings)
			.prop('size', 7)
			.prop('maxlength', 7)
			.wrap(minicolors)
			.after(html);
		
		// Prevent text selection in IE
		input.parent().find('.minicolors-panel').on('selectstart', function() { return false; }).end(); //.css('zoom', settings.zoom);
				
		input.parent().find('.minicolors-panel').css('width', zoom * 173 + 'px').css('height', zoom * 152 + 'px');
		
		input.parent().find('.minicolors-grid').css('width', zoom * 150 + 'px').css('height', zoom * 150 + 'px');
		input.parent().find('.minicolors-grid-inner').css('width', zoom * 150 + 'px').css('height', zoom * 150 + 'px')
				
		input.parent().find('.minicolors-slider').css('width', zoom * 20 + 'px').css('height', zoom * 150 + 'px').css('left', ((zoom * 150)+2) + 'px');
		input.parent().find('.minicolors-opacity-slider').css('width', zoom * 20 + 'px').css('height', zoom * 150 + 'px').css('left', ((zoom * 150)+2) + 'px')
		
		var slider = input.parent().find('.minicolors-slider');
		var sliderpicker = slider.find('[class$=-picker]');
		
		sliderpicker.css('width', ((zoom * 20)-2) + 'px').css('height', zoom * 2 + 'px').css('opacity','0.8').css('border-radius', zoom * 4 + 'px').css('margin-top','-' +  zoom + 'px');		
		
		var grid = input.parent().find('.minicolors-grid');
		gridpicker = grid.find('[class$=-picker]');
		gridpicker.css('width', zoom * 10 + 'px').css('height', zoom * 10 + 'px').css('border-radius', zoom * 6 + 'px').css('margin-top','-' +  zoom * 5.5 + 'px').css('margin-left','-' +  zoom * 5.5 + 'px');
		gridpicker.find('span').css('width', ((zoom * 10)-4) + 'px').css('height', ((zoom * 10)-4) + 'px').css('border-radius', zoom * 6 + 'px');
		
				
				
		//create HSV circle by canvas
		if(settings.control == 'wheel') {
			var canvasElem = input.parent().find('.minicolors-canvas')[0];
			if (canvasElem.getContext) {
				canvasCtx = canvasElem.getContext("2d");
				HSVcircle(canvasElem, canvasCtx); 
			} else {
				console.log("The <canvas> tag is NOT supported on your browser!");
				alert('The <canvas> tag is NOT supported on your browser!');
				input.parent().find('.minicolors-grid').css('background','');
			}
		}
		
		// Detect swatch position
		if( settings.swatchPosition === 'left' ) {
			// Left
			input.before('<span class="minicolors-swatch"><span></span></span>');
		} else {
			// Right
			input.after('<span class="minicolors-swatch"><span></span></span>');
		}
		
		// Disable textfield
		if( !settings.textfield ) input.addClass('minicolors-hidden');
		
		// Inline controls
		if( settings.inline ) input.parent().addClass('minicolors-inline');
		
		updateFromInput(input, false, true);
		
	}
	
	// Returns the input back to its original state
	function destroy(input) {
		
		var minicolors = input.parent();
		
		// Revert the input element
		input
			.removeData('minicolors-initialized')
			.removeData('minicolors-settings')
			.removeProp('size')
			.prop('maxlength', null)
			.removeClass('minicolors-input');
		
		// Remove the wrap and destroy whatever remains
		minicolors.before(input).remove();
		
	}
	
	// Refresh the specified control
	function refresh(input) {
		updateFromInput(input);
	}
	
	// Shows the specified dropdown panel
	function show(input) {
		
		var minicolors = input.parent(),
			panel = minicolors.find('.minicolors-panel'),
			settings = input.data('minicolors-settings');
		
		// Do nothing if uninitialized, disabled, inline, or already open
		if( !input.data('minicolors-initialized') || 
			input.prop('disabled') || 
			minicolors.hasClass('minicolors-inline') || 
			minicolors.hasClass('minicolors-focus')
		) return;
		
		hide();
		
		minicolors.addClass('minicolors-focus');
		panel
			.stop(true, true)
			.fadeIn(settings.showSpeed, function() {
				if( settings.show ) settings.show.call(input.get(0));
			});
		
	}
	
	// Hides all dropdown panels
	function hide() {
		
		$('.minicolors-input').each( function() {
			
			var input = $(this),
				settings = input.data('minicolors-settings'),
				minicolors = input.parent();
			
			// Don't hide inline controls
			if( settings.inline ) return;
			
			minicolors.find('.minicolors-panel').fadeOut(settings.hideSpeed, function() {
				if(minicolors.hasClass('minicolors-focus')) {
					if( settings.hide ) settings.hide.call(input.get(0));
				}
				minicolors.removeClass('minicolors-focus');
			});			
						
		});
	}
	
	
	// Moves the selected picker
	function move(target, event, animate) {
				
		var input = target.parents('.minicolors').find('.minicolors-input'),
			settings = input.data('minicolors-settings'),
			picker = target.find('[class$=-picker]'),
			zoom = settings.zoom,
			offsetX = Math.round(target.offset().left),
			offsetY = Math.round(target.offset().top),
			x = Math.round((event.pageX - offsetX)),
			y = Math.round((event.pageY - offsetY)),
			duration = animate ? settings.animationSpeed : 0,
			wx, wy, r, phi;
		
		// Touch support
		if( event.originalEvent.changedTouches ) {
			x = Math.round((event.originalEvent.changedTouches[0].pageX - offsetX));
			y = Math.round((event.originalEvent.changedTouches[0].pageY - offsetY));
		}
		
		// Constrain picker to its container
		if( x < 0 ) x = 0;
		if( y < 0 ) y = 0;
		if( x > (target.width()) ) x = (target.width());
		if( y > (target.height()) ) y = (target.height());		
		
		var halfsize = 75 * zoom;
		
		// Constrain color wheel values to the wheel
		if( target.parent().is('.minicolors-slider-wheel') && picker.parent().is('.minicolors-grid') ) {
			wx = halfsize - x;
			wy = halfsize - y;
			r = Math.sqrt(wx * wx + wy * wy);
			phi = Math.atan2(wy, wx);
			if( phi < 0 ) phi += Math.PI * 2;
			if( r > halfsize ) {
				r = halfsize;
				x = halfsize - (halfsize * Math.cos(phi));
				y = halfsize - (halfsize * Math.sin(phi));
			}
			x = Math.round(x);
			y = Math.round(y);
		}
				
				
				
		// Move the picker
		if( target.is('.minicolors-grid') ) {
			picker
				.stop(true)
				.animate({
					top: y + 'px',
					left: x + 'px'
				}, duration, settings.animationEasing, function() {
					updateFromControl(input, target);
				});
		} else {
			picker
				.stop(true)
				.animate({
					top: y + 'px'
				}, duration, settings.animationEasing, function() {
					updateFromControl(input, target);
				});
		}
		
	}
	
	// Sets the input based on the color picker values
	function updateFromControl(input, target) {
		
		function getCoords(picker, container) {
			
			var left, top;
			if( !picker.length || !container ) return null;
			left = picker.offset().left;
			top = picker.offset().top;
			
			return {
				x: left - container.offset().left + (picker.outerWidth() / 2),
				y: top - container.offset().top + (picker.outerHeight() / 2)
			};
			
		}
		
		var hue, saturation, brightness, rgb, x, y, r, phi,
			
			hex = input.val(),
			opacity = input.attr('data-opacity'),
			
			// Helpful references
			minicolors = input.parent(),
			settings = input.data('minicolors-settings'),
			panel = minicolors.find('.minicolors-panel'),
			swatch = minicolors.find('.minicolors-swatch'),
			
			// Panel objects
			grid = minicolors.find('.minicolors-grid'),
			slider = minicolors.find('.minicolors-slider'),
			opacitySlider = minicolors.find('.minicolors-opacity-slider'),
			
			// Picker objects
			gridPicker = grid.find('[class$=-picker]'),
			sliderPicker = slider.find('[class$=-picker]'),
			opacityPicker = opacitySlider.find('[class$=-picker]'),
			
			// Picker positions
			gridPos = getCoords(gridPicker, grid),
			sliderPos = getCoords(sliderPicker, slider),
			opacityPos = getCoords(opacityPicker, opacitySlider);
		
		// Handle colors
		if( target.is('.minicolors-grid, .minicolors-slider') ) {
			
			// Determine HSB values
			switch(settings.control) {
				
				case 'wheel':
					var halfsize = 75 * settings.zoom;
					
					// Calculate hue, saturation, and brightness
					x = (grid.width() / 2) - gridPos.x;
					y = (grid.height() / 2) - gridPos.y;
					r = Math.sqrt(x * x + y * y);
					phi = Math.atan2(y, x);
					if( phi < 0 ) phi += Math.PI * 2;
					if( r > halfsize ) {
						r = halfsize;
						gridPos.x = 69 - (halfsize * Math.cos(phi));
						gridPos.y = 69 - (halfsize * Math.sin(phi));
					}
					saturation = keepWithin(r / 0.75, 0, 100);
					hue = keepWithin(phi * 180 / Math.PI, 0, 360);
					brightness = keepWithin(100 - Math.floor(sliderPos.y * (100 / slider.height())), 0, 100);
					hex = hsb2hex({
						h: hue,
						s: saturation,
						b: brightness
					});
					
					// Update UI
					//slider.css('backgroundColor', hsb2hex({ h: hue, s: saturation, b: 100 }));
					slider.css('background', '-webkit-gradient(linear, left top, left bottom, from(' + hsb2hex({ h: hue, s: saturation, b: 100 }) + '), to(#000))');
					break;
				
				case 'saturation':
					// Calculate hue, saturation, and brightness
					hue = keepWithin(parseInt(gridPos.x * (360 / grid.width())), 0, 360);
					saturation = keepWithin(100 - Math.floor(sliderPos.y * (100 / slider.height())), 0, 100);
					brightness = keepWithin(100 - Math.floor(gridPos.y * (100 / grid.height())), 0, 100);
					hex = hsb2hex({
						h: hue,
						s: saturation,
						b: brightness
					});
					
					// Update UI
					slider.css('backgroundColor', hsb2hex({ h: hue, s: 100, b: brightness }));
					minicolors.find('.minicolors-grid-inner').css('opacity', saturation / 100);
					break;
				
				case 'brightness':
					// Calculate hue, saturation, and brightness
					hue = keepWithin(parseInt(gridPos.x * (360 / grid.width())), 0, 360);
					saturation = keepWithin(100 - Math.floor(gridPos.y * (100 / grid.height())), 0, 100);
					brightness = keepWithin(100 - Math.floor(sliderPos.y * (100 / slider.height())), 0, 100);
					hex = hsb2hex({
						h: hue,
						s: saturation,
						b: brightness
					});
					
					// Update UI
					slider.css('backgroundColor', hsb2hex({ h: hue, s: saturation, b: 100 }));
					minicolors.find('.minicolors-grid-inner').css('opacity', 1 - (brightness / 100));
					break;
				
				default:
					// Calculate hue, saturation, and brightness
					hue = keepWithin(360 - parseInt(sliderPos.y * (360 / slider.height())), 0, 360);
					saturation = keepWithin(Math.floor(gridPos.x * (100 / grid.width())), 0, 100);
					brightness = keepWithin(100 - Math.floor(gridPos.y * (100 / grid.height())), 0, 100);
					hex = hsb2hex({
						h: hue,
						s: saturation,
						b: brightness
					});
					
					// Update UI
					grid.css('backgroundColor', hsb2hex({ h: hue, s: 100, b: 100 }));
					break;
				
			}
		
			// Adjust case
	    	input.val( convertCase(hex, settings.letterCase) );
	    	
		}
		
		// Handle opacity
		if( target.is('.minicolors-opacity-slider') ) {
			if( settings.opacity ) {
				opacity = parseFloat(1 - (opacityPos.y / opacitySlider.height())).toFixed(2);
			} else {
				opacity = 1;
			}
			if( settings.opacity ) input.attr('data-opacity', opacity);
		}
		
		// Set swatch color
		swatch.find('SPAN').css({
			backgroundColor: hex,
			opacity: opacity
		});
		
		// Handle change event
		doChange(input, hex, opacity);
		
	}
	
	// Sets the color picker values from the input
	function updateFromInput(input, preserveInputValue, firstRun) {
		
		var hex,
			hsb,
			opacity,
			x, y, r, phi,
			
			// Helpful references
			minicolors = input.parent(),
			settings = input.data('minicolors-settings'),
			swatch = minicolors.find('.minicolors-swatch'),
			
			// Panel objects
			grid = minicolors.find('.minicolors-grid'),
			slider = minicolors.find('.minicolors-slider'),
			opacitySlider = minicolors.find('.minicolors-opacity-slider'),
			
			// Picker objects
			gridPicker = grid.find('[class$=-picker]'),
			sliderPicker = slider.find('[class$=-picker]'),
			opacityPicker = opacitySlider.find('[class$=-picker]');
		
		// Determine hex/HSB values
		hex = convertCase(parseHex(input.val(), true), settings.letterCase);
		if( !hex ) hex = convertCase(parseHex(settings.defaultValue, true));
		hsb = hex2hsb(hex);
		
		// Update input value
		if( !preserveInputValue ) input.val(hex);
		
		// Determine opacity value
		if( settings.opacity ) {
			// Get from data-opacity attribute and keep within 0-1 range
			opacity = input.attr('data-opacity') === '' ? 1 : keepWithin(parseFloat(input.attr('data-opacity')).toFixed(2), 0, 1);
			if( isNaN(opacity) ) opacity = 1;
			input.attr('data-opacity', opacity);
			swatch.find('SPAN').css('opacity', opacity);
			
			// Set opacity picker position
			y = keepWithin(opacitySlider.height() - (opacitySlider.height() * opacity), 0, opacitySlider.height());
			opacityPicker.css('top', y + 'px');
		}
		
		// Update swatch
		swatch.find('SPAN').css('backgroundColor', hex);
		
		// Determine picker locations
		switch(settings.control) {
			
			case 'wheel':
				var halfsize = 75 * settings.zoom;
				var fullsize = 150 * settings.zoom;
				
				// Set grid position
				r = keepWithin(Math.ceil(hsb.s * (halfsize/100)), 0, grid.height() / 2);
				phi = hsb.h * Math.PI / 180;
				x = keepWithin(halfsize - Math.cos(phi) * r, 0, grid.width());
				y = keepWithin(halfsize - Math.sin(phi) * r, 0, grid.height());
				gridPicker.css({
					top: y + 'px',
					left: x + 'px'
				});
				
				// Set slider position
				y = fullsize - (hsb.b / (100 / grid.height()));
				if( hex === '' ) y = 0;
				sliderPicker.css('top', y + 'px');
				
				// Update panel color
				//slider.css('backgroundColor', hsb2hex({ h: hsb.h, s: hsb.s, b: 100 }));
				
				//slider.css('backgroundColor', hsb2hex({ h: hsb.h, s: hsb.s, b: 100 }));	
				//slider.css('background', '-moz-linear-gradient(0% 6% 270deg, #000000, ' + hsb2hex({ h: hsb.h, s: hsb.s, b: 100 }) + ') repeat scroll 0 0 transparent');
				slider.css('background', '-webkit-gradient(linear, left top, left bottom, from(' + hsb2hex({ h: hsb.h, s: hsb.s, b: 100 }) + '), to(#000))');
				break;
			
			case 'saturation':
				// Set grid position
				x = keepWithin((5 * hsb.h) / 12, 0, fullsize);
				y = keepWithin(grid.height() - Math.ceil(hsb.b / (100 / grid.height())), 0, grid.height());
				gridPicker.css({
					top: y + 'px',
					left: x + 'px'
				});				
				
				// Set slider position
				y = keepWithin(slider.height() - (hsb.s * (slider.height() / 100)), 0, slider.height());
				sliderPicker.css('top', y + 'px');
				
				// Update UI
				slider.css('backgroundColor', hsb2hex({ h: hsb.h, s: 100, b: hsb.b }));
				minicolors.find('.minicolors-grid-inner').css('opacity', hsb.s / 100);
				
				break;
			
			case 'brightness':
				// Set grid position
				x = keepWithin((5 * hsb.h) / 12, 0, fullsize);
				y = keepWithin(grid.height() - Math.ceil(hsb.s / (100 / grid.height())), 0, grid.height());
				gridPicker.css({
					top: y + 'px',
					left: x + 'px'
				});				
				
				// Set slider position
				y = keepWithin(slider.height() - (hsb.b * (slider.height() / 100)), 0, slider.height());
				sliderPicker.css('top', y + 'px');
				
				// Update UI
				slider.css('backgroundColor', hsb2hex({ h: hsb.h, s: hsb.s, b: 100 }));
				minicolors.find('.minicolors-grid-inner').css('opacity', 1 - (hsb.b / 100));
				break;
			
			default:
				// Set grid position
				x = keepWithin(Math.ceil(hsb.s / (100 / grid.width())), 0, grid.width());
				y = keepWithin(grid.height() - Math.ceil(hsb.b / (100 / grid.height())), 0, grid.height());
				gridPicker.css({
					top: y + 'px',
					left: x + 'px'
				});
				
				// Set slider position
				y = keepWithin(slider.height() - (hsb.h / (360 / slider.height())), 0, slider.height());
				sliderPicker.css('top', y + 'px');
				
				// Update panel color
				grid.css('backgroundColor', hsb2hex({ h: hsb.h, s: 100, b: 100 }));
				break;
				
		}
		
		// Handle change event
		if( !firstRun ) doChange(input, hex, opacity);
		
	}
	
	// Runs the change and changeDelay callbacks
	function doChange(input, hex, opacity) {
		
		var settings = input.data('minicolors-settings');
		
		// Only run if it actually changed
		if( hex + opacity !== input.data('minicolors-lastChange') ) {
			
			// Remember last-changed value
			input.data('minicolors-lastChange', hex + opacity);
			
			// Fire change event
			if( settings.change ) {
				if( settings.changeDelay ) {
					// Call after a delay
					clearTimeout(input.data('minicolors-changeTimeout'));
					input.data('minicolors-changeTimeout', setTimeout( function() {
						settings.change.call(input.get(0), hex, opacity);
					}, settings.changeDelay));
				} else {
					// Call immediately
					settings.change.call(input.get(0), hex, opacity);
				}
			}
			
		}
	
	}
	
	// Generates an RGB(A) object based on the input's value
	function rgbObject(input) {
		var hex = parseHex($(input).val(), true),
			rgb = hex2rgb(hex),
			opacity = $(input).attr('data-opacity');
		if( !rgb ) return null;
		if( opacity !== undefined ) $.extend(rgb, { a: parseFloat(opacity) });
		return rgb;
	}
	
	// Genearates an RGB(A) string based on the input's value
	function rgbString(input, alpha) {
		var hex = parseHex($(input).val(), true),
			rgb = hex2rgb(hex),
			opacity = $(input).attr('data-opacity');
		if( !rgb ) return null;
		if( opacity === undefined ) opacity = 1;
		if( alpha ) {
			return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + parseFloat(opacity) + ')';
		} else {
			return 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
		}
	}
	
	// Converts to the letter case specified in settings
	function convertCase(string, letterCase) {
		return letterCase === 'uppercase' ? string.toUpperCase() : string.toLowerCase();
	}
	
	// Parses a string and returns a valid hex string when possible
	function parseHex(string, expand) {
		string = string.replace(/[^A-F0-9]/ig, '');
		if( string.length !== 3 && string.length !== 6 ) return '';
		if( string.length === 3 && expand ) {
			string = string[0] + string[0] + string[1] + string[1] + string[2] + string[2];
		}
		return '#' + string;
	}
	
	// Keeps value within min and max
	function keepWithin(value, min, max) {
		if( value < min ) value = min;
		if( value > max ) value = max;
		return value;
	}
	
	// Converts an HSB object to an RGB object
	function hsb2rgb(hsb) {
		var rgb = {};
		var h = Math.round(hsb.h);
		var s = Math.round(hsb.s * 255 / 100);
		var v = Math.round(hsb.b * 255 / 100);
		if(s === 0) {
			rgb.r = rgb.g = rgb.b = v;
		} else {
			var t1 = v;
			var t2 = (255 - s) * v / 255;
			var t3 = (t1 - t2) * (h % 60) / 60;
			if( h === 360 ) h = 0;
			if( h < 60 ) { rgb.r = t1; rgb.b = t2; rgb.g = t2 + t3; }
			else if( h < 120 ) {rgb.g = t1; rgb.b = t2; rgb.r = t1 - t3; }
			else if( h < 180 ) {rgb.g = t1; rgb.r = t2; rgb.b = t2 + t3; }
			else if( h < 240 ) {rgb.b = t1; rgb.r = t2; rgb.g = t1 - t3; }
			else if( h < 300 ) {rgb.b = t1; rgb.g = t2; rgb.r = t2 + t3; }
			else if( h < 360 ) {rgb.r = t1; rgb.g = t2; rgb.b = t1 - t3; }
			else { rgb.r = 0; rgb.g = 0; rgb.b = 0; }
		}
		return {
			r: Math.round(rgb.r),
			g: Math.round(rgb.g),
			b: Math.round(rgb.b)
		};
	}
	
	// Converts an RGB object to a hex string
	function rgb2hex(rgb) {
		var hex = [
			rgb.r.toString(16),
			rgb.g.toString(16),
			rgb.b.toString(16)
		];
		$.each(hex, function(nr, val) {
			if (val.length === 1) hex[nr] = '0' + val;
		});
		return '#' + hex.join('');
	}
	
	// Converts an HSB object to a hex string
	function hsb2hex(hsb) {
		return rgb2hex(hsb2rgb(hsb));
	}
	
	// Converts a hex string to an HSB object
	function hex2hsb(hex) {
		var hsb = rgb2hsb(hex2rgb(hex));
		if( hsb.s === 0 ) hsb.h = 360;
		return hsb;
	}
	
	// Converts an RGB object to an HSB object
	function rgb2hsb(rgb) {
		var hsb = { h: 0, s: 0, b: 0 };
		var min = Math.min(rgb.r, rgb.g, rgb.b);
		var max = Math.max(rgb.r, rgb.g, rgb.b);
		var delta = max - min;
		hsb.b = max;
		hsb.s = max !== 0 ? 255 * delta / max : 0;
		if( hsb.s !== 0 ) {
			if( rgb.r === max ) {
				hsb.h = (rgb.g - rgb.b) / delta;
			} else if( rgb.g === max ) {
				hsb.h = 2 + (rgb.b - rgb.r) / delta;
			} else {
				hsb.h = 4 + (rgb.r - rgb.g) / delta;
			}
		} else {
			hsb.h = -1;
		}
		hsb.h *= 60;
		if( hsb.h < 0 ) {
			hsb.h += 360;
		}
		hsb.s *= 100/255;
		hsb.b *= 100/255;
		return hsb;
	}
	
	
	function hsv2rgba(h, s, v, alpha) {
		h = h % 360;

		if (h < 0) {
			h += 360;
		}

		var c = v * s;
		var h1 = h / 60;
		var x = c * (1 - Math.abs(h1%2 - 1));
		var r1 = 0, g1 = 0, b1 = 0;

		switch (Math.floor(h1)) {
		case 0: r1 = c; g1 = x; b1 = 0; break;
		case 1: r1 = x; g1 = c; b1 = 0; break;
		case 2: r1 = 0; g1 = c; b1 = x; break;
		case 3: r1 = 0; g1 = x; b1 = c; break;
		case 4: r1 = x; g1 = 0; b1 = c; break;
		case 5: r1 = c; g1 = 0; b1 = x; break;
		}

		var m = v - c;

		return {
			r: Math.floor((r1 + m) * 255),
			g: Math.floor((g1 + m) * 255),
			b: Math.floor((b1 + m) * 255),
			alpha: alpha
		};
	};
	
	// Converts a hex string to an RGB object
	function hex2rgb(hex) {
		hex = parseInt(((hex.indexOf('#') > -1) ? hex.substring(1) : hex), 16);
		return {
			r: hex >> 16,
			g: (hex & 0x00FF00) >> 8,
			b: (hex & 0x0000FF)
		};
	}
	
	// Handle events
	$(document)
		// Hide on clicks outside of the control
		.on('mousedown.minicolors touchstart.minicolors', function(event) {
			if( !$(event.target).parents().add(event.target).hasClass('minicolors') ) {
				hide();
			}
		})
		// Start moving
		.on('mousedown.minicolors touchstart.minicolors', '.minicolors-grid, .minicolors-slider, .minicolors-opacity-slider', function(event) {
			var target = $(this);
			event.preventDefault();
			$(document).data('minicolors-target', target);
			move(target, event, true);
		})
		// Move pickers
		.on('mousemove.minicolors touchmove.minicolors', function(event) {
			var target = $(document).data('minicolors-target');
			if( target ) move(target, event);
		})
		// Stop moving
		.on('mouseup.minicolors touchend.minicolors', function() {
			$(this).removeData('minicolors-target');
		})
		// Toggle panel when swatch is clicked
		.on('mousedown.minicolors touchstart.minicolors', '.minicolors-swatch', function(event) {
			event.preventDefault();
			var input = $(this).parent().find('.minicolors-input'),
				minicolors = input.parent();
			if( minicolors.hasClass('minicolors-focus') ) {
				hide(input);
			} else {
				show(input);
			}
		})
		// Show on focus
		.on('focus.minicolors', '.minicolors-input', function(event) {
			var input = $(this);
			if( !input.data('minicolors-initialized') ) return;
			show(input);
		})
		// Fix hex on blur
		.on('blur.minicolors', '.minicolors-input', function(event) {
			var input = $(this),
				settings = input.data('minicolors-settings');
			if( !input.data('minicolors-initialized') ) return;
			
			// Parse Hex
			input.val(parseHex(input.val(), true));
			
			// Is it blank?
			if( input.val() === '' ) input.val(parseHex(settings.defaultValue, true));
			
			// Adjust case
			input.val( convertCase(input.val(), settings.letterCase) );
			
		})
		// Handle keypresses
		.on('keydown.minicolors', '.minicolors-input', function(event) {
			var input = $(this);
			if( !input.data('minicolors-initialized') ) return;
			switch(event.keyCode) {
				case 9: // tab
					hide();
					break;
				case 13: // enter
				case 27: // esc
					hide();
					input.blur();
					break;
			}
		})
		// Update on keyup
		.on('keyup.minicolors', '.minicolors-input', function(event) {
			var input = $(this);
			if( !input.data('minicolors-initialized') ) return;
			updateFromInput(input, true);
		})
		// Update on paste
		.on('paste.minicolors', '.minicolors-input', function(event) {
			var input = $(this);
			if( !input.data('minicolors-initialized') ) return;
			setTimeout( function() {
				updateFromInput(input, true);
			}, 1);
		});
	
})(jQuery);