/**
 * Inline script + CSS injected into Marp slide preview when inspect=1.
 * Handles selection (click toggle), outlines, drag/resize, and live style preview.
 * Sends selection-state and style-apply back to parent; parent owns the inspector panel.
 */

export function buildPresentationInspectAssets(options: {
  activeSlide: number;
  slideMarkdown?: string;
  totalSlides: number;
}) {
  const { activeSlide, totalSlides } = options;
  const sourceBlocks = extractSourceBlocks(options.slideMarkdown ?? "");

  const css = `
      body[data-inspect="true"] {
        cursor: pointer;
      }
      body[data-inspect="true"] section img {
        max-width: 100% !important;
        height: auto;
      }
      body[data-inspect="true"] section,
      body[data-inspect="true"] h1,
      body[data-inspect="true"] h2,
      body[data-inspect="true"] h3,
      body[data-inspect="true"] h4,
      body[data-inspect="true"] h5,
      body[data-inspect="true"] h6,
      body[data-inspect="true"] p,
      body[data-inspect="true"] li,
      body[data-inspect="true"] a,
      body[data-inspect="true"] strong,
      body[data-inspect="true"] em,
      body[data-inspect="true"] code,
      body[data-inspect="true"] pre,
      body[data-inspect="true"] blockquote,
      body[data-inspect="true"] span,
      body[data-inspect="true"] img {
        cursor: pointer;
      }
      body[data-inspect="true"][data-apploop-editing-active="true"],
      body[data-inspect="true"] [data-apploop-editing="true"],
      body[data-inspect="true"] [contenteditable="true"] {
        cursor: text !important;
      }
      body[data-inspect="true"] .apploop-inspect-hover:not(.apploop-inspect-selected) {
        outline: 2px dashed #60a5fa !important;
        outline-offset: 2px;
      }
      body[data-inspect="true"] .apploop-inspect-selected {
        outline: 2px solid #38bdf8 !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35);
      }
      body[data-inspect="true"] .apploop-inspect-selected[data-active-edit="true"] {
        outline: 2px solid #fbbf24 !important;
        box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.45);
      }
      body[data-inspect="true"] .apploop-empty-managed-host {
        pointer-events: none !important;
      }
      body[data-inspect="true"] .apploop-empty-managed-host span[class*="apploop-el-"],
      body[data-inspect="true"] .apploop-empty-managed-host .pill {
        pointer-events: auto !important;
      }
      #apploop-inspect-box {
        position: absolute;
        z-index: 2147483645;
        border: 1px solid rgba(251, 191, 36, 0.9);
        box-shadow: 0 0 0 1px rgba(0,0,0,0.35);
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        display: none;
      }
      #apploop-inspect-box[data-open="true"] { display: block; }
      #apploop-inspect-box .handle {
        position: absolute;
        width: 10px;
        height: 10px;
        background: #fbbf24;
        border: 1px solid #111;
        border-radius: 2px;
        pointer-events: auto;
      }
      #apploop-inspect-box .handle.br { right: -5px; bottom: -5px; cursor: nwse-resize; }
      #apploop-inspect-box .handle.bm { left: 50%; bottom: -5px; margin-left: -5px; cursor: ns-resize; }
      #apploop-inspect-box .handle.mr { right: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }
      #apploop-alignment-guides {
        position: fixed;
        inset: 0;
        z-index: 2147483644;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
      }
      #apploop-alignment-guides .guide {
        position: absolute;
        display: none;
        background: rgba(34, 211, 238, 0.95);
        box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.35), 0 0 12px rgba(34, 211, 238, 0.55);
      }
      #apploop-alignment-guides .guide[data-open="true"] { display: block; }
      #apploop-alignment-guides .guide.vertical { width: 1px; }
      #apploop-alignment-guides .guide.horizontal { height: 1px; }
      #apploop-inspect-box .drag {
              position: absolute;
              left: 0; right: 0; top: -22px;
              height: 20px;
              pointer-events: auto;
              cursor: grab;
              user-select: none;
              -webkit-user-select: none;
              touch-action: none;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #111;
              background: #fbbf24;
              border-radius: 6px 6px 0 0;
              font: 10px/1 Inter, system-ui, sans-serif;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }
            #apploop-inspect-box .drag:active {
              cursor: grabbing;
            }
            #apploop-inspect-box .drag-del {
              position: absolute;
              right: 2px; top: 2px;
              width: 16px; height: 16px;
              border: none;
              background: rgba(0,0,0,0.45);
              color: #fca5a5;
              border-radius: 3px;
              cursor: pointer;
              font: 11px/1 monospace;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: auto;
            }
            #apploop-inspect-box .drag-del:hover {
              background: #dc2626;
              color: #fff;
            }
            #apploop-inspect-box[data-table-cell="true"] .drag,
            #apploop-inspect-box[data-table-cell="true"] .drag-del {
              display: none;
            }
            #apploop-inspect-box[data-list-item="true"] .drag,
            #apploop-inspect-box[data-list-item="true"] .handle {
              display: none;
            }
            #apploop-inspect-box .handle {
              position: absolute;
              width: 10px;
              height: 10px;
              background: #fbbf24;
              border: 1px solid #111;
              border-radius: 2px;
              pointer-events: auto;
            }
            #apploop-inspect-box .handle.br { right: -5px; bottom: -5px; cursor: nwse-resize; }
            #apploop-inspect-box .handle.bm { left: 50%; bottom: -5px; margin-left: -5px; cursor: ns-resize; }
            #apploop-inspect-box .handle.mr { right: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }

            .apploop-inspect-edit-input {
              position: absolute;
              z-index: 2147483646;
              min-width: 80px;
              padding: 2px 4px;
              font: inherit;
              color: #111;
              background: #fffbe6;
              border: 2px solid #fbbf24;
              border-radius: 4px;
              outline: none;
            }
  `;

  const script = `
      <script>
        (function () {
          var inspect = true;
          var slide = ${activeSlide};
          var totalSlides = ${totalSlides};
          var sourceBlocks = ${JSON.stringify(sourceBlocks)};
          var selected = [];
          var activeId = null;
          var hoverEl = null;
          var dragging = null;
          var resizing = null;
          var lastGestureKind = null;
          var keyboardMoveDirty = false;
          var keyboardMoveSaveTimer = null;
          var alignmentGuideHideTimer = null;
          var suppressNextMouseDown = false;
          var suppressNextClick = false;
          var lastDragEvent = null;
          var selectableSelector = 'h1,h2,h3,h4,h5,h6,p,ul,ol,li,blockquote,pre,table,img,hr,rect,circle,ellipse,line,path,polygon,polyline,span[class*="apploop-el-"],.pill';
          var svgShapeSelector = 'rect,circle,ellipse,line,path,polygon,polyline';

          document.body.setAttribute('data-inspect', 'true');

          document.addEventListener('dragstart', function (event) {
            if (event.target && event.target.closest && event.target.closest('#apploop-inspect-box')) {
              event.preventDefault();
            }
          }, true);

          function cleanText(value) {
            return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
          }

          function blockText(value) {
            return String(value || '').replace(/\\s+/g, ' ').trim();
          }

          function canonicalSourceTag(el) {
            var tag = el && el.tagName ? el.tagName.toLowerCase() : '';
            if (el && el.classList && el.classList.contains('pill')) return 'pill';
            if (tag === 'li') return 'li';
            if (/^(rect|circle|ellipse|line|path|polygon|polyline)$/.test(tag)) return tag;
            if (tag === 'span' || (el && el.classList && el.classList.contains('pill'))) {
              var block = el.closest ? el.closest('h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table,hr') : null;
              if (block && block !== el) tag = block.tagName.toLowerCase();
            }
            if (/^h[1-6]$/.test(tag) || /^(table|ul|ol|blockquote|pre|img|hr|rect|circle|ellipse|line|path|polygon|polyline)$/.test(tag)) return tag;
            return 'p';
          }

          function shapeText(el) {
            if (!el) return '';
            var marker = el.getAttribute && el.getAttribute('data-apploop-shape');
            if (marker) return 'data-apploop-shape="' + marker + '"';
            return el.outerHTML || (el.tagName ? el.tagName.toLowerCase() : 'shape');
          }

          function imageText(el) {
            return blockText((el && el.getAttribute && el.getAttribute('src')) || 'image');
          }

          function imageAltText(el) {
            return blockText((el && el.getAttribute && el.getAttribute('alt')) || '');
          }

          function sourceTextForElement(el) {
            if (!el) return '';
            var tag = canonicalSourceTag(el);
            var candidates = tag === 'li'
              ? Array.prototype.slice.call(document.querySelectorAll('li'))
              : inspectableElements().filter(function (candidate) {
                return canonicalSourceTag(candidate) === tag;
              });
            var index = candidates.indexOf(el);
            if (index < 0) return tag === 'img' ? imageText(el) : (/^(rect|circle|ellipse|line|path|polygon|polyline)$/.test(tag) ? shapeText(el) : blockText(el.textContent || (el.getAttribute && el.getAttribute('alt')) || ''));
            var matchingBlocks = sourceBlocks.filter(function (block) { return block.tag === tag; });
            return matchingBlocks[index] && matchingBlocks[index].text ? matchingBlocks[index].text : (tag === 'img' ? imageText(el) : (/^(rect|circle|ellipse|line|path|polygon|polyline)$/.test(tag) ? shapeText(el) : blockText(el.textContent || (el.getAttribute && el.getAttribute('alt')) || '')));
          }

          function cssPath(el) {
            if (!(el instanceof Element)) return '';
            var parts = [];
            var node = el;
            var depth = 0;
            while (node && node.nodeType === 1 && depth < 6) {
              var tag = node.tagName.toLowerCase();
              if (tag === 'foreignobject' || (tag === 'div' && node.classList.contains('marpit'))) break;
              var parent = node.parentElement;
              if (parent) {
                var siblings = Array.prototype.filter.call(parent.children, function (child) {
                  return child.tagName === node.tagName;
                });
                if (siblings.length > 1) {
                  tag += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
                }
              }
              parts.unshift(tag);
              node = parent;
              depth += 1;
              if (tag.indexOf('section') === 0 || (node && node.tagName && node.tagName.toLowerCase() === 'section')) {
                if (tag.indexOf('section') !== 0) parts.unshift('section');
                break;
              }
            }
            return parts.join(' > ');
          }

          function isEmptyManagedTextHost(el) {
            if (!el || !el.querySelectorAll || !el.tagName) return false;
            var tag = el.tagName.toLowerCase();
            if (!(tag === 'p' || /^h[1-6]$/.test(tag))) return false;
            if (!el.querySelector('span[class*="apploop-el-"],.pill')) return false;
            var clone = el.cloneNode(true);
            Array.prototype.forEach.call(clone.querySelectorAll('span[class*="apploop-el-"],.pill'), function (child) {
              child.remove();
            });
            return cleanText(clone.textContent || '').length === 0;
          }

          function refreshEmptyManagedTextHosts() {
            Array.prototype.forEach.call(document.querySelectorAll('.apploop-empty-managed-host'), function (node) {
              node.classList.remove('apploop-empty-managed-host');
            });
            Array.prototype.forEach.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p'), function (node) {
              if (isEmptyManagedTextHost(node)) node.classList.add('apploop-empty-managed-host');
            });
          }

          function resolveClickTarget(raw) {
            if (!(raw instanceof Element)) return null;
            if (raw.closest && raw.closest('#apploop-inspect-box')) return null;
            var target = raw;
            var tag = target.tagName.toLowerCase();
            if (tag === 'svg' || tag === 'foreignobject') {
              var section = document.querySelector('section');
              if (section) target = section;
            }
            if (target.matches && target.matches(svgShapeSelector)) return target;
            var table = target.closest ? target.closest('table') : null;
            if (table) return table;
            var list = target.closest ? target.closest('ul,ol') : null;
            if (list) return list;
            var quote = target.closest ? target.closest('blockquote') : null;
            if (quote) return quote;
            var fence = target.closest ? target.closest('pre') : null;
            if (fence) return fence;
            var divider = target.closest ? target.closest('hr') : null;
            if (divider) return divider;
            var wrapped = target.closest ? target.closest('span[class*="apploop-el-"]') : null;
            if (wrapped) return wrapped;
            var pill = target.closest ? target.closest('.pill') : null;
            if (pill) return pill;
            if (target.tagName && target.tagName.toLowerCase() === 'section') return null;
            if (isEmptyManagedTextHost(target)) return null;
            if (target.matches && target.matches(selectableSelector + ',a,strong,em,code')) return target;
            var nearest = target.closest ? target.closest(selectableSelector + ',a,strong,em,code') : null;
            if (isEmptyManagedTextHost(nearest)) return null;
            if (nearest && nearest.tagName && !/^(body|section)$/i.test(nearest.tagName)) return nearest;
            return null;
          }

          function pathToElement(path) {
            if (!path) return null;
            try { return document.querySelector(path); } catch (e) { return null; }
          }

          function resolveTargetElement(item) {
            if (!item) return null;
            var el = pathToElement(item.path);
            if (item.tag === 'hr' && el && el.tagName && el.tagName.toLowerCase() !== 'hr' && el.querySelector) {
              return el.querySelector('hr') || el;
            }
            return el;
          }

          function apploopClassForElement(el) {
            if (!el) return '';
            var holder = null;
            if (el.classList && Array.prototype.some.call(el.classList, function (name) { return /^apploop-el-/.test(name); })) {
              holder = el;
            }
            if (!holder && el.closest) holder = el.closest('[class*="apploop-el-"]');
            if (!holder) return '';
            var classes = Array.prototype.slice.call(holder.classList || []);
            return classes.find(function (name) { return /^apploop-el-/.test(name); }) || '';
          }

          function savedStyleForElement(el) {
            var className = apploopClassForElement(el);
            if (!className) return {};
            var map = {
              background: 'background', backgroundImage: 'background-image', color: 'color',
              width: 'width', maxWidth: 'max-width', height: 'height', boxSizing: 'box-sizing', padding: 'padding', margin: 'margin',
              paddingLeft: 'padding-left', border: 'border', borderRadius: 'border-radius',
              borderCollapse: 'border-collapse', borderSpacing: 'border-spacing', tableLayout: 'table-layout', listStyleType: 'list-style-type', opacity: 'opacity',
              visibility: 'visibility', pointerEvents: 'pointer-events',
              fontSize: 'font-size', fontStyle: 'font-style', fontWeight: 'font-weight', lineHeight: 'line-height',
              letterSpacing: 'letter-spacing', textTransform: 'text-transform', textAlign: 'text-align',
              boxShadow: 'box-shadow', textShadow: 'text-shadow',
              fill: 'fill', fillOpacity: 'fill-opacity', stroke: 'stroke', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', strokeWidth: 'stroke-width',
              backgroundClip: 'background-clip', webkitBackgroundClip: '-webkit-background-clip', webkitTextFillColor: '-webkit-text-fill-color',
              left: 'left', top: 'top', right: 'right', bottom: 'bottom',
              transform: 'transform', position: 'position', zIndex: 'z-index',
              alignSelf: 'align-self', justifySelf: 'justify-self', display: 'display',
            };
            var style = {};
            Array.prototype.forEach.call(document.styleSheets || [], function (sheet) {
              var rules = null;
              try { rules = sheet.cssRules || sheet.rules; } catch (e) { rules = null; }
              if (!rules) return;
              Array.prototype.forEach.call(rules, function (rule) {
                if (!rule || !rule.selectorText || !rule.style || rule.selectorText.indexOf(className) === -1) return;
                Object.keys(map).forEach(function (key) {
                  var value = rule.style.getPropertyValue(map[key]);
                  if (value && value.trim()) style[key] = value.trim().replace(/\\s*!important\\s*$/i, '');
                });
              });
            });
            return style;
          }

          function inlineStyleForElement(el) {
            var map = {
              background: 'background', backgroundImage: 'background-image', color: 'color',
              width: 'width', maxWidth: 'max-width', height: 'height', boxSizing: 'box-sizing', padding: 'padding', margin: 'margin',
              paddingLeft: 'padding-left', border: 'border', borderRadius: 'border-radius',
              borderCollapse: 'border-collapse', borderSpacing: 'border-spacing', tableLayout: 'table-layout', listStyleType: 'list-style-type', opacity: 'opacity',
              visibility: 'visibility', pointerEvents: 'pointer-events',
              fontSize: 'font-size', fontStyle: 'font-style', fontWeight: 'font-weight', lineHeight: 'line-height',
              letterSpacing: 'letter-spacing', textTransform: 'text-transform', textAlign: 'text-align',
              boxShadow: 'box-shadow', textShadow: 'text-shadow',
              fill: 'fill', fillOpacity: 'fill-opacity', stroke: 'stroke', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', strokeWidth: 'stroke-width',
              backgroundClip: 'background-clip', webkitBackgroundClip: '-webkit-background-clip', webkitTextFillColor: '-webkit-text-fill-color',
              left: 'left', top: 'top', right: 'right', bottom: 'bottom',
              transform: 'transform', position: 'position', zIndex: 'z-index',
              alignSelf: 'align-self', justifySelf: 'justify-self', display: 'display',
            };
            var style = {};
            if (!el || !el.style) return style;
            Object.keys(map).forEach(function (key) {
              var value = el.style.getPropertyValue(map[key]);
              if (value && value.trim()) style[key] = value.trim().replace(/\s*!important\s*$/i, '');
            });
            return style;
          }

          function selectionStyleForElement(el) {
            var saved = savedStyleForElement(el);
            var inline = inlineStyleForElement(el);
            return Object.assign({}, saved, inline);
          }

          function promoteSavedManagedStyles() {
            var existing = document.getElementById('apploop-inspect-managed-priority');
            if (existing) existing.remove();
            var rulesText = [];
            Array.prototype.forEach.call(document.styleSheets || [], function (sheet) {
              var rules = null;
              try { rules = sheet.cssRules || sheet.rules; } catch (e) { rules = null; }
              if (!rules) return;
              Array.prototype.forEach.call(rules, function (rule) {
                if (!rule || !rule.selectorText || !rule.style || rule.selectorText.indexOf('apploop-el-') === -1) return;
                var declarations = [];
                for (var i = 0; i < rule.style.length; i += 1) {
                  var prop = rule.style[i];
                  var value = rule.style.getPropertyValue(prop);
                  if (prop && value && value.trim()) declarations.push(prop + ': ' + value.trim().replace(/\\s*!important\\s*$/i, '') + ' !important;');
                }
                if (declarations.length) rulesText.push(rule.selectorText + ' { ' + declarations.join(' ') + ' }');
              });
            });
            if (!rulesText.length) return;
            var style = document.createElement('style');
            style.id = 'apploop-inspect-managed-priority';
            style.textContent = rulesText.join('\\n');
            document.head.appendChild(style);
          }

          promoteSavedManagedStyles();
          refreshEmptyManagedTextHosts();

          function targetId(path, tag, text) {
            return path + '::' + tag + '::' + text;
          }

          function inspectableElements() {
            var nodes = Array.prototype.slice.call(document.querySelectorAll(selectableSelector));
            var paths = [];
            return nodes.filter(function (el) {
              if (!el || !el.textContent && el.tagName.toLowerCase() !== 'img' && el.tagName.toLowerCase() !== 'hr' && !el.matches(svgShapeSelector)) return false;
              if (el.closest && el.closest('#apploop-inspect-box')) return false;
              if (el.classList && el.classList.contains('apploop-empty-managed-host')) return false;
              if (cleanText(el.textContent || '').length === 0 && el.tagName.toLowerCase() !== 'img' && el.tagName.toLowerCase() !== 'hr' && !el.matches(svgShapeSelector)) return false;
              var tag = el.tagName.toLowerCase();
              var atomicParent = el.closest ? el.closest('blockquote,pre,table') : null;
              if (atomicParent && atomicParent !== el) return false;
              var parentPill = el.closest ? el.closest('.pill') : null;
              if (parentPill && parentPill !== el && el.matches && el.matches('span[class*="apploop-el-"]')) return false;
              if (tag === 'li' && el.closest('ul,ol')) return false;
              if (isEmptyManagedTextHost(el)) return false;
              var rect = el.getBoundingClientRect();
              if (rect.width <= 0 && rect.height <= 0 && tag !== 'img' && tag !== 'hr' && !el.matches(svgShapeSelector)) return false;
              var path = cssPath(el);
              if (!path || paths.indexOf(path) !== -1) return false;
              paths.push(path);
              return true;
            });
          }

          function applyStyleToElement(el, style) {
            if (!el || !style) return;
            var map = {
              background: 'background', backgroundImage: 'background-image', color: 'color',
              width: 'width', maxWidth: 'max-width', height: 'height', boxSizing: 'box-sizing', padding: 'padding', margin: 'margin',
              paddingLeft: 'padding-left', border: 'border', borderRadius: 'border-radius',
              borderCollapse: 'border-collapse', borderSpacing: 'border-spacing', tableLayout: 'table-layout', listStyleType: 'list-style-type', opacity: 'opacity',
              visibility: 'visibility', pointerEvents: 'pointer-events',
              fontSize: 'font-size', fontStyle: 'font-style', fontWeight: 'font-weight', lineHeight: 'line-height',
              letterSpacing: 'letter-spacing', textTransform: 'text-transform', textAlign: 'text-align',
              boxShadow: 'box-shadow', textShadow: 'text-shadow',
              fill: 'fill', fillOpacity: 'fill-opacity', stroke: 'stroke', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', strokeWidth: 'stroke-width',
              backgroundClip: 'background-clip', webkitBackgroundClip: '-webkit-background-clip', webkitTextFillColor: '-webkit-text-fill-color',
              left: 'left', top: 'top', right: 'right', bottom: 'bottom',
              transform: 'transform', position: 'position', zIndex: 'z-index',
              alignSelf: 'align-self', justifySelf: 'justify-self', display: 'display',
            };
            function setStyleProp(node, key, value) {
              var cssName = map[key];
              if (!node || !cssName) return;
              if (value === undefined || value === null || value === '') {
                node.style.removeProperty(cssName);
              } else {
                node.style.setProperty(cssName, String(value).replace(/\\s*!important\\s*$/i, ''), 'important');
              }
            }
            var isTable = el.tagName && el.tagName.toLowerCase() === 'table';
            var isImage = el.tagName && el.tagName.toLowerCase() === 'img';
            Object.keys(style).forEach(function (key) {
              if (isTable && (key === 'padding' || key === 'border')) return;
              if (isTable && (key === 'display' || key === 'tableLayout')) return;
              setStyleProp(el, key, style[key]);
            });
            if (isTable) {
              setStyleProp(el, 'display', 'table');
              setStyleProp(el, 'width', style.width && String(style.width).trim() ? style.width : '100%');
              setStyleProp(el, 'tableLayout', 'fixed');
            }
            if (isImage) {
              setStyleProp(el, 'maxWidth', '100%');
              if (!style.height || String(style.height).trim() === '') setStyleProp(el, 'height', 'auto');
            }
            var textPaintKeys = ['backgroundImage', 'backgroundClip', 'webkitBackgroundClip', 'webkitTextFillColor', 'color'];
            var shouldPatchPaintChildren = textPaintKeys.some(function (key) {
              return Object.prototype.hasOwnProperty.call(style, key);
            });
            if (shouldPatchPaintChildren && el.querySelectorAll) {
              Array.prototype.forEach.call(el.querySelectorAll('span[class*="apploop-el-"]'), function (child) {
                if (child === el) return;
                textPaintKeys.forEach(function (key) {
                  setStyleProp(child, key, style[key]);
                });
              });
            }
            if (isTable && el.querySelectorAll) {
              Array.prototype.forEach.call(el.querySelectorAll('th,td'), function (cell) {
                if (style.padding !== undefined) setStyleProp(cell, 'padding', style.padding);
                if (style.border !== undefined) setStyleProp(cell, 'border', style.border);
              });
            }
          }

          function layerLabelForItem(item) {
            var text = cleanText(item.alt || item.text || item.tag || '');
            var label = item.tag ? item.tag.toUpperCase() : 'Element';
            return text ? label + ' · ' + text.slice(0, 48) : label;
          }

          function itemFromElement(el, domIndex) {
            if (!el) return null;
            var path = cssPath(el);
            if (!path) return null;
            var tag = el.classList && el.classList.contains('pill') ? 'pill' : el.tagName.toLowerCase();
            var text = String(sourceTextForElement(el) || el.textContent || (el.getAttribute && (el.getAttribute('alt') || el.getAttribute('src'))) || (/^(rect|circle|ellipse|line|path|polygon|polyline)$/.test(tag) ? shapeText(el) : (tag === 'hr' ? '<hr />' : tag))).trim();
            var style = selectionStyleForElement(el);
            var computed = window.getComputedStyle ? window.getComputedStyle(el) : null;
            var rawZ = style.zIndex || (computed ? computed.zIndex : '');
            var parsedZ = Number.parseInt(rawZ || '', 10);
            var item = {
              id: targetId(path, tag, cleanText(text)),
              slide: slide,
              totalSlides: totalSlides,
              path: path,
              tag: tag,
              text: text,
              alt: tag === 'img' ? imageAltText(el) : undefined,
              style: style,
              baselineStyle: {},
              domIndex: domIndex,
              zIndex: Number.isFinite(parsedZ) ? parsedZ : 0,
              hidden: style.visibility === 'hidden' || Boolean(computed && computed.visibility === 'hidden'),
              locked: style.pointerEvents === 'none' || Boolean(computed && computed.pointerEvents === 'none'),
            };
            item.label = layerLabelForItem(item);
            return item;
          }

          function layerItems() {
            return inspectableElements()
              .map(function (el, index) { return itemFromElement(el, index); })
              .filter(Boolean)
              .sort(function (a, b) {
                if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
                return a.domIndex - b.domIndex;
              })
              .map(function (item, index) {
                item.layerIndex = index;
                return item;
              });
          }

          function applySelectedOutlines() {
            Array.prototype.forEach.call(document.querySelectorAll('.apploop-inspect-selected'), function (node) {
              node.classList.remove('apploop-inspect-selected');
              node.removeAttribute('data-active-edit');
            });
            selected.forEach(function (item) {
              var el = pathToElement(item.path);
              if (!el) return;
              el = syncItemToVisibleElement(item, el);
              if (!el) return;
              el.classList.add('apploop-inspect-selected');
              if (item.id === activeId) el.setAttribute('data-active-edit', 'true');
              applyStyleToElement(el, item.style);
            });
            refreshEmptyManagedTextHosts();
            updatePositionBox();
          }

          function getActive() {
            return selected.find(function (item) { return item.id === activeId; }) || selected[selected.length - 1] || null;
          }

          function visibleElementForItem(item, fallbackEl) {
            var el = fallbackEl || (item ? pathToElement(item.path) : null);
            if (!item || !el) return el;
            if (el.classList && Array.prototype.some.call(el.classList, function (name) { return /^apploop-el-/.test(name); })) return el;
            if (!el.querySelectorAll) return el;
            var managed = Array.prototype.slice.call(el.querySelectorAll('span[class*="apploop-el-"]'));
            var match = managed.find(function (candidate) {
              return cleanText(candidate.textContent || '') === item.text;
            }) || managed[0];
            return match || el;
          }

          function syncItemToVisibleElement(item, fallbackEl) {
            var el = visibleElementForItem(item, fallbackEl);
            if (item && el && fallbackEl && el !== fallbackEl) {
              var previousId = item.id;
              item.path = cssPath(el);
              item.tag = el.tagName.toLowerCase();
              item.id = targetId(item.path, item.tag, item.text);
              if (activeId === previousId) activeId = item.id;
            }
            return el;
          }

          // --- selection box chrome ---
          var box = document.createElement('div');
          box.id = 'apploop-inspect-box';
          box.innerHTML = '<div class="drag">drag</div><button class="drag-del" title="Delete element">&times;</button><div class="handle br" data-handle="br"></div><div class="handle bm" data-handle="bm"></div><div class="handle mr" data-handle="mr"></div>';
          document.body.appendChild(box);

          var guides = document.createElement('div');
          guides.id = 'apploop-alignment-guides';
          guides.innerHTML = '<div class="guide vertical"></div><div class="guide horizontal"></div>';
          document.body.appendChild(guides);
          var verticalGuide = guides.querySelector('.vertical');
          var horizontalGuide = guides.querySelector('.horizontal');

          function setBoxOpen(open) {
            box.setAttribute('data-open', open ? 'true' : 'false');
          }

          function isTableCellSelection(item, el) {
            var tag = item && item.tag ? String(item.tag).toLowerCase() : '';
            var elementTag = el && el.tagName ? el.tagName.toLowerCase() : '';
            return tag === 'td' || tag === 'th' || elementTag === 'td' || elementTag === 'th';
          }

          function isListItemSelection(item, el) {
            var tag = item && item.tag ? String(item.tag).toLowerCase() : '';
            var elementTag = el && el.tagName ? el.tagName.toLowerCase() : '';
            return tag === 'li' || elementTag === 'li';
          }

          function updatePositionBox() {
            var item = getActive();
            if (!item) {
              setBoxOpen(false);
              return;
            }
            var el = pathToElement(item.path);
            if (!el) {
              setBoxOpen(false);
              return;
            }
            el = syncItemToVisibleElement(item, el);
            if (!el) {
              setBoxOpen(false);
              return;
            }
            var rect = el.getBoundingClientRect();
            box.style.left = rect.left + 'px';
            box.style.top = rect.top + 'px';
            box.style.width = Math.max(8, rect.width) + 'px';
            box.style.height = Math.max(8, rect.height) + 'px';
            box.setAttribute('data-table-cell', isTableCellSelection(item, el) ? 'true' : 'false');
            box.setAttribute('data-list-item', isListItemSelection(item, el) ? 'true' : 'false');
            setBoxOpen(true);
          }

          function setGuideOpen(guide, open) {
            if (!guide) return;
            guide.setAttribute('data-open', open ? 'true' : 'false');
          }

          function hideAlignmentGuides() {
            if (alignmentGuideHideTimer) window.clearTimeout(alignmentGuideHideTimer);
            alignmentGuideHideTimer = null;
            setGuideOpen(verticalGuide, false);
            setGuideOpen(horizontalGuide, false);
          }

          function hideAlignmentGuidesSoon() {
            if (alignmentGuideHideTimer) window.clearTimeout(alignmentGuideHideTimer);
            alignmentGuideHideTimer = window.setTimeout(hideAlignmentGuides, 650);
          }

          function updateAlignmentGuidesForElement(el, options) {
            if (!el) return;
            var srect = sectionBox();
            var rect = el.getBoundingClientRect();
            var threshold = 6;
            var elementCenterX = rect.left + rect.width / 2;
            var elementCenterY = rect.top + rect.height / 2;
            var slideCenterX = srect.left + srect.width / 2;
            var slideCenterY = srect.top + srect.height / 2;
            var showVertical = Math.abs(elementCenterX - slideCenterX) <= threshold;
            var showHorizontal = Math.abs(elementCenterY - slideCenterY) <= threshold;
            if (verticalGuide) {
              verticalGuide.style.left = slideCenterX + 'px';
              verticalGuide.style.top = srect.top + 'px';
              verticalGuide.style.height = srect.height + 'px';
              setGuideOpen(verticalGuide, showVertical);
            }
            if (horizontalGuide) {
              horizontalGuide.style.left = srect.left + 'px';
              horizontalGuide.style.top = slideCenterY + 'px';
              horizontalGuide.style.width = srect.width + 'px';
              setGuideOpen(horizontalGuide, showHorizontal);
            }
            if (!options || !options.keepOpen) hideAlignmentGuidesSoon();
          }

          function patchActiveStyle(partial) {
            var item = getActive();
            if (!item) return;
            item.style = Object.assign({}, item.style || {}, partial);
            var el = syncItemToVisibleElement(item, pathToElement(item.path));
            if (el) {
              applyStyleToElement(el, item.style);
              updatePositionBox();
            }
            emitSelectionState();
          }

          function patchItemStyle(item, partial) {
            if (!item) return;
            item.style = Object.assign({}, item.style || {}, partial);
            var el = syncItemToVisibleElement(item, pathToElement(item.path));
            if (el) applyStyleToElement(el, item.style);
          }

          function hasExplicitTableWidth(style) {
            var width = style && style.width ? String(style.width).trim() : '';
            return Boolean(width && !/^100%\s*(?:!important)?$/i.test(width));
          }

          function isSvgShapeElement(el) {
            return Boolean(el && el.matches && el.matches(svgShapeSelector));
          }

          function parseTranslatePx(transform) {
            var value = String(transform || '');
            var match = value.match(/translate\(\s*(-?\d+(?:\.\d+)?)px(?:\s*,\s*|\s+)(-?\d+(?:\.\d+)?)px\s*\)/i)
              || value.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*,\s*0(?:px)?\s*\)/i);
            return { x: match ? Number(match[1]) || 0 : 0, y: match ? Number(match[2]) || 0 : 0 };
          }

          function translateStyleFrom(start, dx, dy) {
            return 'translate(' + Math.round((start && start.x ? start.x : 0) + dx) + 'px, ' + Math.round((start && start.y ? start.y : 0) + dy) + 'px)';
          }

          function slideBoundedWidthPx(width, srect) {
            return Math.round(Math.min(Math.max(24, width), Math.max(24, srect.width))) + 'px';
          }

          function renderedToSlideCssSize(width, height) {
            var section = document.querySelector('section');
            var srect = section ? section.getBoundingClientRect() : null;
            var cssWidth = section && section.offsetWidth ? section.offsetWidth : (srect ? srect.width : 0);
            var cssHeight = section && section.offsetHeight ? section.offsetHeight : (srect ? srect.height : 0);
            var scaleX = srect && cssWidth ? srect.width / cssWidth : 1;
            var scaleY = srect && cssHeight ? srect.height / cssHeight : 1;
            var nextWidth = Number(width) / (scaleX > 0 ? scaleX : 1);
            var nextHeight = Number(height) / (scaleY > 0 ? scaleY : 1);
            return {
              width: Number.isFinite(nextWidth) && nextWidth > 0 ? Math.round(nextWidth) + 'px' : null,
              height: Number.isFinite(nextHeight) && nextHeight > 0 ? Math.round(nextHeight) + 'px' : null,
            };
          }

          function preserveElementDimensions(style, item, width, height) {
            var size = renderedToSlideCssSize(width, height);
            style.boxSizing = 'border-box';
            if (size.width) style.width = size.width;
            if (size.height) style.height = size.height;
          }

          function isTextLikeElement(el) {
            var tag = el && el.tagName ? el.tagName.toLowerCase() : '';
            return /^(h1|h2|h3|h4|h5|h6|p|li|blockquote|span)$/.test(tag) || Boolean(el && el.classList && el.classList.contains('pill'));
          }

          function setTemporaryDragBox(el, width, height) {
            if (!el || !el.style || !isTextLikeElement(el)) return;
            el.style.setProperty('width', Math.round(width) + 'px', 'important');
            el.style.setProperty('height', Math.round(height) + 'px', 'important');
          }

          function clearTemporaryDragBox(el, item) {
            if (!el || !el.style || !isTextLikeElement(el)) return;
            if (!(item && item.style && item.style.width)) el.style.removeProperty('width');
            if (!(item && item.style && item.style.height)) el.style.removeProperty('height');
          }

          function moveSelectedBy(dxPx, dyPx) {
            if (!selected.length) return;
            var srect = sectionBox();
            var moved = false;
            selected.forEach(function (item) {
              var el = syncItemToVisibleElement(item, pathToElement(item.path));
              if (!el) return;
              if (!elementCanPosition(el, item)) return;
              if (isSvgShapeElement(el)) {
                var currentTransform = parseTranslatePx(item.style && item.style.transform);
                patchItemStyle(item, {
                  transform: translateStyleFrom(currentTransform, dxPx, dyPx),
                  zIndex: item.style.zIndex || '3',
                });
                updateAlignmentGuidesForElement(el);
                moved = true;
                return;
              }
              var movingImage = el.tagName && el.tagName.toLowerCase() === 'img';
              var rect = el.getBoundingClientRect();
              var currentLeftPct = ((rect.left - srect.left) / srect.width) * 100;
              var currentTopPct = ((rect.top - srect.top) / srect.height) * 100;
              var nextLeftPct = Math.max(0, Math.min(95, currentLeftPct + (dxPx / srect.width) * 100));
              var nextTopPct = Math.max(0, Math.min(95, currentTopPct + (dyPx / srect.height) * 100));
              var movingTable = el.tagName && el.tagName.toLowerCase() === 'table';
              var movingTableHasExplicitWidth = movingTable && hasExplicitTableWidth(item.style);
              var moveStyle = {
                display: movingTable ? 'table' : 'inline-block',
                position: 'absolute',
                left: nextLeftPct.toFixed(2) + '%',
                top: nextTopPct.toFixed(2) + '%',
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
                zIndex: item.style.zIndex || '3',
              };
              preserveElementDimensions(moveStyle, item, rect.width, rect.height);
              if (movingTable) {
                if (movingTableHasExplicitWidth) moveStyle.width = item.style.width;
                moveStyle.tableLayout = 'fixed';
              }
              if (movingImage) moveStyle.maxWidth = '100%';
              patchItemStyle(item, moveStyle);
              updateAlignmentGuidesForElement(el);
              moved = true;
            });
            if (!moved) return;
            scheduleKeyboardMoveSave();
            updatePositionBox();
            emitSelectionState();
          }

          function emitStyleApply(messageType, requestId) {
            window.parent.postMessage({
              type: messageType || 'apploop-presentation-style-apply',
              requestId: requestId || null,
              slide: slide,
              totalSlides: totalSlides,
              targets: selected.map(function (item) {
                return {
                  id: item.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  text: item.text,
                  alt: item.alt,
                  path: item.path,
                  style: item.style || {},
                };
              })
            }, '*');
          }

          function scheduleKeyboardMoveSave() {
            keyboardMoveDirty = true;
            if (keyboardMoveSaveTimer) window.clearTimeout(keyboardMoveSaveTimer);
            keyboardMoveSaveTimer = window.setTimeout(function () {
              if (!keyboardMoveDirty) return;
              keyboardMoveDirty = false;
              keyboardMoveSaveTimer = null;
              emitStyleApply('apploop-presentation-style-apply');
            }, 180);
          }

          function emitSelectionState() {
            window.parent.postMessage({
              type: 'apploop-presentation-selection-state',
              slide: slide,
              totalSlides: totalSlides,
              activeId: activeId,
              layers: layerItems(),
              targets: selected.map(function (item) {
                return {
                  id: item.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  text: item.text,
                  alt: item.alt,
                  path: item.path,
                  style: item.style || {},
                };
              })
            }, '*');
          }

          function toggleSelect(el, additive) {
            var item = itemFromElement(el, 0);
            if (!item) return;
            var id = item.id;
            var existing = selected.find(function (item) { return item.id === id; });
            if (existing && additive) {
              selected = selected.filter(function (item) { return item.id !== id; });
              if (activeId === id) activeId = selected.length ? selected[selected.length - 1].id : null;
              applySelectedOutlines();
              emitSelectionState();
              return;
            }
            if (existing) {
              selected = [existing];
              activeId = id;
              applySelectedOutlines();
              emitSelectionState();
              return;
            }
            selected = additive ? selected.concat(item) : [item];
            activeId = id;
            applySelectedOutlines();
            emitSelectionState();
          }

          function selectAllElements() {
            selected = inspectableElements().map(function (el) {
              return itemFromElement(el, 0);
            }).filter(Boolean);
            activeId = selected.length ? selected[selected.length - 1].id : null;
            applySelectedOutlines();
            emitSelectionState();
          }

          // Click to select/unselect
          document.addEventListener('click', function (event) {
            if (!inspect) return;
            if (suppressNextClick) {
              suppressNextClick = false;
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (event.detail && event.detail > 1) return;
            if (event.target && event.target.closest) {
              if (event.target.closest('#apploop-inspect-box')) return;
              if (event.target.closest('.apploop-inspect-edit-input')) return;
            }
            event.preventDefault();
            event.stopPropagation();
            var target = resolveClickTarget(event.target);
            if (!target) return;
            toggleSelect(target, Boolean(event.shiftKey || event.metaKey || event.ctrlKey));
          }, true);

          // Delete button in selection box
          box.addEventListener('click', function (event) {
            if (event.target && event.target.closest && event.target.closest('.drag-del')) {
              event.preventDefault();
              event.stopPropagation();
              var item = getActive();
              if (!item) return;
              if (isTableCellSelection(item, pathToElement(item.path))) return;
              window.parent.postMessage({
                type: 'apploop-presentation-delete-element',
                slide: slide,
                totalSlides: totalSlides,
                tag: item.tag,
                text: item.text,
                path: item.path
              }, '*');
            }
          }, true);

          // Double-click to edit text on active selected element
          document.addEventListener('dblclick', function (event) {
            if (!inspect) return;
            var target = event.target && event.target.closest ? event.target.closest('th,td,li') : null;
            if (!target) target = resolveClickTarget(event.target);
            if (!target) return;
            // Check if another element is already being edited.
            if (document.querySelector('[data-apploop-editing="true"]')) return;
            var item = selected.find(function (s) { return s.id === activeId; });
            event.preventDefault();
            event.stopPropagation();
            if (!item || !target.isSameNode(pathToElement(item.path))) {
              var path = cssPath(target);
              var tag = target.classList && target.classList.contains('pill') ? 'pill' : target.tagName.toLowerCase();
              var text = cleanText(target.textContent || '');
              var id = targetId(path, tag, text);
              item = { id: id, path: path, tag: tag, text: text, style: selectionStyleForElement(target), baselineStyle: {} };
              selected = [item];
              activeId = id;
              applySelectedOutlines();
              emitSelectionState();
            }
            var previousText = target.textContent || '';
            var listContext = target.tagName && target.tagName.toLowerCase() === 'li' && target.closest ? target.closest('ul,ol') : null;
            var previousListText = listContext ? sourceTextForElement(listContext) : '';
            var editingNodes = [];
            document.body.setAttribute('data-apploop-editing-active', 'true');

            function markdownListTextFromElement(list, previousSource) {
              if (!list) return '';
              var ordered = list.tagName && list.tagName.toLowerCase() === 'ol';
              var sourceLines = String(previousSource || '').split(/\\n/).filter(function (line) {
                return /^\\s*(?:[-*+]|\\d+[.)])\\s+/.test(line);
              });
              var firstBullet = sourceLines[0] && sourceLines[0].match(/^\\s*([-*+])\\s+/);
              var bullet = firstBullet ? firstBullet[1] : '-';
              return Array.prototype.slice.call(list.children || []).filter(function (node) {
                return node && node.tagName && node.tagName.toLowerCase() === 'li';
              }).map(function (node, index) {
                var text = blockText(node.textContent || '');
                if (ordered) return (index + 1) + '. ' + text;
                var checkbox = sourceLines[index] && sourceLines[index].match(/^\\s*[-*+]\\s+(\\[[ xX]\\]\\s*)/);
                return bullet + ' ' + (checkbox ? checkbox[1] : '') + text;
              }).join('\\n');
            }

            function placeCaretIn(node, selectContents) {
              node.focus();
              var range = document.createRange();
              range.selectNodeContents(node);
              if (!selectContents) range.collapse(false);
              var selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }

            function unmarkEditing(node) {
              if (!node) return;
              var record = editingNodes.find(function (entry) { return entry.node === node; });
              if (record) {
                if (record.previousContentEditable === null) node.removeAttribute('contenteditable');
                else node.setAttribute('contenteditable', record.previousContentEditable);
              }
              node.removeAttribute('data-apploop-editing');
              node.removeEventListener('blur', commit);
              node.removeEventListener('keydown', handleEditKeyDown);
            }

            function markEditing(node, selectContents) {
              if (!node) return;
              if (target && target !== node) unmarkEditing(target);
              target = node;
              if (!editingNodes.some(function (entry) { return entry.node === node; })) {
                editingNodes.push({ node: node, previousContentEditable: node.getAttribute('contenteditable') });
              }
              node.setAttribute('contenteditable', 'true');
              node.setAttribute('data-apploop-editing', 'true');
              node.addEventListener('blur', commit);
              node.addEventListener('keydown', handleEditKeyDown);
              placeCaretIn(node, selectContents);
              if (listContext && node.tagName && node.tagName.toLowerCase() === 'li') {
                var path = cssPath(node);
                var text = cleanText(node.textContent || '');
                item.path = path;
                item.tag = 'li';
                item.text = text;
                item.id = targetId(path, 'li', text);
                selected = [item];
                activeId = item.id;
                applySelectedOutlines();
                updatePositionBox();
                emitSelectionState();
              }
            }
            markEditing(target, true);
            var committed = false;
            function cleanup() {
              document.body.removeAttribute('data-apploop-editing-active');
              editingNodes.forEach(function (entry) { unmarkEditing(entry.node); });
              applySelectedOutlines();
            }
            function commit() {
              if (committed) return;
              committed = true;
              var newText = listContext ? markdownListTextFromElement(listContext, previousListText) : blockText(target.textContent || '');
              var previousBlockText = listContext ? previousListText : blockText(previousText);
              if (newText && newText !== previousBlockText) {
                var shortText = cleanText(target.textContent || '');
                var oldText = item.text;
                item.text = shortText;
                // Reconstruct id with new text since text is part of identity
                item.id = targetId(item.path, item.tag, shortText);
                window.parent.postMessage({
                  type: 'apploop-presentation-text-edit',
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  oldText: previousBlockText || oldText,
                  text: newText,
                  path: item.path
                }, '*');
              }
              cleanup();
            }
            function cancel() {
              committed = true;
              if (listContext) {
                var insertedItems = Array.prototype.slice.call(listContext.querySelectorAll('li[data-apploop-inserted="true"]'));
                insertedItems.forEach(function (node) { node.remove(); });
              } else {
                target.textContent = previousText;
              }
              cleanup();
            }
            function handleEditKeyDown(e) {
              if (e.key === 'Enter' && listContext) {
                e.preventDefault();
                var newItem = document.createElement('li');
                newItem.setAttribute('data-apploop-inserted', 'true');
                newItem.innerHTML = '<br>';
                if (target.nextSibling) listContext.insertBefore(newItem, target.nextSibling);
                else listContext.appendChild(newItem);
                markEditing(newItem, false);
                return;
              }
              if (e.key === 'Enter') { e.preventDefault(); target.blur(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }
          }, true);

          document.addEventListener('mousemove', function (event) {
            if (!inspect || dragging || resizing) return;
            var target = resolveClickTarget(event.target);
            if (!target) return;
            if (hoverEl && hoverEl !== target) hoverEl.classList.remove('apploop-inspect-hover');
            hoverEl = target;
            if (!hoverEl.classList.contains('apploop-inspect-selected')) {
              hoverEl.classList.add('apploop-inspect-hover');
            }
          }, true);

          // Drag / resize active element
          function sectionBox() {
            var section = document.querySelector('section');
            return section ? section.getBoundingClientRect() : document.body.getBoundingClientRect();
          }

          function isTableOrListPart(el) {
            if (!el || !el.tagName) return false;
            var tag = el.tagName.toLowerCase();
            if (/^(li|tr|td|th|thead|tbody|tfoot|col|colgroup)$/.test(tag)) return true;
            if (/^(ul|ol|table)$/.test(tag)) return false;
            return Boolean(el.closest && el.closest('li,tr,td,th,thead,tbody,tfoot,col,colgroup'));
          }

          function elementCanPosition(el, item) {
            if (item && item.style && item.style.pointerEvents === 'none') return false;
            return Boolean(el && !isTableOrListPart(el));
          }

          function beginBoxGesture(event) {
            var item = getActive();
            if (!item) return;
            var el = syncItemToVisibleElement(item, pathToElement(item.path));
            if (!el) return;
            if (!elementCanPosition(el, item)) return;
            var handle = event.target && event.target.getAttribute ? event.target.getAttribute('data-handle') : null;
            var rect = el.getBoundingClientRect();
            var srect = sectionBox();
            if (handle) {
              lastGestureKind = 'resize';
              resizing = {
                handle: handle,
                startX: event.clientX,
                startY: event.clientY,
                startW: rect.width,
                startH: rect.height,
                startLeft: rect.left - srect.left,
                startTop: rect.top - srect.top,
                srect: srect,
                el: el,
                item: item,
                startTransform: isSvgShapeElement(el) ? parseTranslatePx(item.style && item.style.transform) : null,
              };
            } else {
              lastGestureKind = 'drag';
              dragging = {
                startX: event.clientX,
                startY: event.clientY,
                startW: rect.width,
                startLeft: rect.left - srect.left,
                startTop: rect.top - srect.top,
                srect: srect,
                el: el,
                item: item,
              };
            }
            if (dragging || resizing) window.parent.postMessage({ type: 'apploop-presentation-drag-start' }, '*');
            event.preventDefault();
            event.stopPropagation();
          }

          box.addEventListener('pointerdown', function (event) {
            suppressNextMouseDown = true;
            if (event.target && event.target.setPointerCapture && event.pointerId !== undefined) {
              try { event.target.setPointerCapture(event.pointerId); } catch (e) {}
            }
            beginBoxGesture(event);
          }, true);

          box.addEventListener('mousedown', function (event) {
            if (suppressNextMouseDown) {
              suppressNextMouseDown = false;
              return;
            }
            beginBoxGesture(event);
          }, true);

          function handleDragMove(event) {
            if (dragging || resizing) lastDragEvent = event;
            if (dragging) {
              var dx = event.clientX - dragging.startX;
              var dy = event.clientY - dragging.startY;
              var draggingTable = dragging.el && dragging.el.tagName && dragging.el.tagName.toLowerCase() === 'table';
              var draggingImage = dragging.el && dragging.el.tagName && dragging.el.tagName.toLowerCase() === 'img';
              var leftPx = dragging.startLeft + dx;
              var topPx = dragging.startTop + dy;
              var leftPct = Math.max(0, Math.min(95, (leftPx / dragging.srect.width) * 100));
              var topPct = Math.max(0, Math.min(95, (topPx / dragging.srect.height) * 100));
              var draggingTableHasExplicitWidth = draggingTable && dragging.item && hasExplicitTableWidth(dragging.item.style);
              if (isSvgShapeElement(dragging.el)) {
                patchActiveStyle({
                  transform: translateStyleFrom(dragging.startTransform, dx, dy),
                  zIndex: dragging.item.style.zIndex || '3',
                });
              } else {
                setTemporaryDragBox(dragging.el, dragging.startW, dragging.startH);
                var dragStyle = {
                  display: draggingTable ? 'table' : 'inline-block',
                  position: 'absolute',
                  left: leftPct.toFixed(2) + '%',
                  top: topPct.toFixed(2) + '%',
                  right: 'auto',
                  bottom: 'auto',
                  transform: 'none',
                  zIndex: dragging.item.style.zIndex || '3',
                };
                preserveElementDimensions(dragStyle, dragging.item, dragging.startW, dragging.startH);
                if (draggingTable) {
                  if (draggingTableHasExplicitWidth) dragStyle.width = dragging.item.style.width;
                  dragStyle.tableLayout = 'fixed';
                }
                if (draggingImage) dragStyle.maxWidth = '100%';
                patchActiveStyle(dragStyle);
              }
              updateAlignmentGuidesForElement(dragging.el, { keepOpen: true });
            }
            if (resizing) {
              var rdx = event.clientX - resizing.startX;
              var rdy = event.clientY - resizing.startY;
              var resizingTable = resizing.el && resizing.el.tagName && resizing.el.tagName.toLowerCase() === 'table';
              var resizingImage = resizing.el && resizing.el.tagName && resizing.el.tagName.toLowerCase() === 'img';
              var w = Math.max(24, resizing.startW + (resizing.handle === 'bm' ? 0 : rdx));
              var h = Math.max(16, resizing.startH + (resizing.handle === 'mr' ? 0 : rdy));
              patchActiveStyle({
                display: resizingTable ? 'table' : 'inline-block',
                position: 'absolute',
                boxSizing: 'border-box',
                width: resizingImage ? slideBoundedWidthPx(w, resizing.srect) : Math.round(w) + 'px',
                maxWidth: resizingImage ? '100%' : undefined,
                tableLayout: resizingTable ? 'fixed' : undefined,
                height: Math.round(h) + 'px',
                zIndex: resizing.item.style.zIndex || '3',
              });
              updateAlignmentGuidesForElement(resizing.el, { keepOpen: true });
            }
          }

          window.addEventListener('mousemove', handleDragMove, true);
          document.addEventListener('mousemove', handleDragMove, true);
          window.addEventListener('pointermove', handleDragMove, true);
          document.addEventListener('pointermove', handleDragMove, true);

          function finishDrag(event) {
            event = event && event.clientX !== undefined ? event : lastDragEvent || event;
            var didGesture = Boolean(dragging || resizing);
            var gestureKind = lastGestureKind;
            if (dragging) clearTemporaryDragBox(dragging.el, dragging.item);
            dragging = null;
            resizing = null;
            lastGestureKind = null;
            lastDragEvent = null;
            if (didGesture) window.parent.postMessage({ type: 'apploop-presentation-drag-end' }, '*');
            if (didGesture) {
              hideAlignmentGuidesSoon();
              emitStyleApply('apploop-presentation-style-apply');
            }
          }

          window.addEventListener('mouseup', finishDrag, true);
          document.addEventListener('mouseup', finishDrag, true);
          window.addEventListener('pointerup', finishDrag, true);
          document.addEventListener('pointerup', finishDrag, true);
          window.addEventListener('pointercancel', finishDrag, true);
          document.addEventListener('pointercancel', finishDrag, true);
          box.addEventListener('lostpointercapture', finishDrag, true);
          window.addEventListener('blur', function (event) {
            if (event.target !== window) return;
            finishDrag(lastDragEvent || {});
          });
          document.documentElement.addEventListener('mouseleave', function (event) {
            if (event.relatedTarget) return;
            finishDrag(lastDragEvent || {});
          });

          window.addEventListener('keydown', function (event) {
            if (!inspect) return;
            if (document.querySelector('[data-apploop-editing="true"]')) return;
            if (event.key === 'Escape') {
              if (selected.length) {
                selected = [];
                activeId = null;
                applySelectedOutlines();
                emitSelectionState();
                event.preventDefault();
                event.stopPropagation();
              }
              return;
            }
            if ((event.metaKey || event.ctrlKey) && (event.key === 'z' || event.key === 'Z')) {
              event.preventDefault();
              event.stopPropagation();
              window.parent.postMessage({ type: event.shiftKey ? 'apploop-presentation-request-redo' : 'apploop-presentation-request-undo' }, '*');
              return;
            }
            if (!selected.length) return;
            if (!/^Arrow(?:Left|Right|Up|Down)$/.test(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            var step = event.shiftKey ? 12 : 4;
            if (event.key === 'ArrowLeft') moveSelectedBy(-step, 0);
            if (event.key === 'ArrowRight') moveSelectedBy(step, 0);
            if (event.key === 'ArrowUp') moveSelectedBy(0, -step);
            if (event.key === 'ArrowDown') moveSelectedBy(0, step);
          }, true);

          window.addEventListener('keyup', function (event) {
            if (!keyboardMoveDirty || !/^Arrow(?:Left|Right|Up|Down)$/.test(event.key)) return;
            scheduleKeyboardMoveSave();
          }, true);

          window.addEventListener('message', function (event) {
            var data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'apploop-presentation-set-selections') {
              refreshEmptyManagedTextHosts();
              var incoming = Array.isArray(data.targets) ? data.targets : [];
              selected = incoming.map(function (t) {
                var path = t.path;
                var resolved = pathToElement(path);
                if (t.tag === 'hr' && resolved && resolved.tagName && resolved.tagName.toLowerCase() !== 'hr' && resolved.querySelector) {
                  resolved = resolved.querySelector('hr') || resolved;
                  path = cssPath(resolved);
                }
                if (!resolved || cleanText(resolved.textContent || '') !== t.text) {
                  var replacement = inspectableElements().find(function (candidate) {
                      return candidate.tagName.toLowerCase() === t.tag && (t.tag === 'hr' || cleanText(candidate.textContent || '') === t.text);
                  });
                  if (replacement) path = cssPath(replacement);
                }
                return {
                  id: t.id || targetId(path, t.tag, t.text),
                  path: path,
                  tag: t.tag,
                  text: t.text,
                  alt: t.alt,
                  style: t.style || {},
                  baselineStyle: {},
                };
              });
              if (data.activeId) activeId = data.activeId;
              else if (selected.length) activeId = selected[selected.length - 1].id;
              else activeId = null;
              applySelectedOutlines();
            }
            if (data.type === 'apploop-presentation-clear-selections') {
              selected = [];
              activeId = null;
              applySelectedOutlines();
            }
            if (data.type === 'apploop-presentation-select-all-elements') {
              selectAllElements();
            }
            if (data.type === 'apploop-presentation-move-selection') {
              var moveDy = Number(data.dyPx) || 0;
              moveSelectedBy(Number(data.dxPx) || 0, moveDy);
            }
            if (data.type === 'apploop-presentation-drag-move') {
              var syntheticMove = { clientX: Number(data.clientX) || 0, clientY: Number(data.clientY) || 0 };
              handleDragMove(syntheticMove);
            }
            if (data.type === 'apploop-presentation-finish-drag') {
              finishDrag(lastDragEvent || {});
            }
            if (data.type === 'apploop-presentation-flush-styles') {
              if (keyboardMoveSaveTimer) window.clearTimeout(keyboardMoveSaveTimer);
              keyboardMoveSaveTimer = null;
              keyboardMoveDirty = false;
              emitStyleApply('apploop-presentation-style-apply', typeof data.requestId === 'string' ? data.requestId : null);
            }
            if (data.type === 'apploop-presentation-focus-target' && data.id) {
              activeId = data.id;
              applySelectedOutlines();
            }
            if (data.type === 'apploop-presentation-request-delete-active') {
              var item = getActive();
              if (!item) return;
              if (isTableCellSelection(item, pathToElement(item.path))) return;
              window.parent.postMessage({
                type: 'apploop-presentation-delete-element',
                slide: slide,
                totalSlides: totalSlides,
                tag: item.tag,
                text: item.text,
                path: item.path
              }, '*');
            }
            if (data.type === 'apploop-presentation-patch-style' && data.id) {
              var target = selected.find(function (item) { return item.id === data.id; });
              if (!target) return;
              target.style = Object.assign({}, target.style || {}, data.style || {});
              var el = resolveTargetElement(target);
              if (el) applyStyleToElement(el, data.style || {});
              updatePositionBox();
              emitSelectionState();
            }
            if (data.type === 'apploop-presentation-apply-all-styles') {
              data.targets.forEach(function (patchTarget) {
                var target = selected.find(function (item) { return item.id === patchTarget.id; });
                var el = resolveTargetElement(target || patchTarget);
                if (!el) return;
                var nextStyle = Object.assign({}, patchTarget.style || {});
                if (target) target.style = nextStyle;
                applyStyleToElement(el, nextStyle);
              });
              updatePositionBox();
              emitSelectionState();
            }
          });

          window.addEventListener('resize', updatePositionBox);
          window.addEventListener('resize', hideAlignmentGuides);

          emitSelectionState();
          window.parent.postMessage({
            type: 'apploop-presentation-slide-ready',
            slide: slide,
            totalSlides: totalSlides
          }, '*');
        })();
      </script>
  `;

  return { css, script };
}

function extractSourceBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<{ tag: string; text: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed || /^<!--\s*_/.test(trimmed)) continue;
    if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(trimmed) || /^<img\b/i.test(trimmed)) {
      blocks.push({ tag: "img", text: imageSourceFromMarkdown(trimmed) || trimmed });
      continue;
    }
    if (/^<hr\b/i.test(trimmed) || /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ tag: "hr", text: trimmed });
      continue;
    }
    const svgShape = trimmed.match(/^<(rect|circle|ellipse|line|path|polygon|polyline)\b/i);
    if (svgShape) {
      blocks.push({ tag: svgShape[1]!.toLowerCase(), text: trimmed });
      continue;
    }
    if (/^</.test(trimmed) && trimmed.replace(/<[^>]+>/g, "").trim().length === 0) continue;
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ tag: `h${heading[1].length}`, text: trimmed });
      continue;
    }
    if (isMarkdownTableLine(trimmed)) {
      const start = index;
      while (index + 1 < lines.length && isMarkdownTableLine((lines[index + 1] ?? "").trim())) index += 1;
      blocks.push({ tag: "table", text: lines.slice(start, index + 1).join("\n") });
      continue;
    }
    if (isMarkdownListItem(trimmed)) {
      const start = index;
      const tag = /^\d+\./.test(trimmed) ? "ol" : "ul";
      while (index + 1 < lines.length && isMarkdownListItem((lines[index + 1] ?? "").trim())) index += 1;
      for (const itemLine of lines.slice(start, index + 1)) {
        blocks.push({ tag: "li", text: itemLine });
      }
      blocks.push({ tag, text: lines.slice(start, index + 1).join("\n") });
      continue;
    }
    if (trimmed.startsWith(">")) {
      const start = index;
      while (index + 1 < lines.length && (lines[index + 1] ?? "").trim().startsWith(">")) index += 1;
      blocks.push({ tag: "blockquote", text: lines.slice(start, index + 1).join("\n") });
      continue;
    }
    if (trimmed.startsWith("```")) {
      const start = index;
      while (index + 1 < lines.length && !(lines[index + 1] ?? "").trim().startsWith("```")) index += 1;
      if (index + 1 < lines.length) index += 1;
      blocks.push({ tag: "pre", text: lines.slice(start, index + 1).join("\n") });
      continue;
    }
    const start = index;
    while (index + 1 < lines.length) {
      const next = (lines[index + 1] ?? "").trim();
      if (!next || /^#{1,6}\s+/.test(next) || isMarkdownTableLine(next) || isMarkdownListItem(next) || next.startsWith(">") || next.startsWith("```")) break;
      index += 1;
    }
    blocks.push({ tag: "p", text: lines.slice(start, index + 1).join("\n") });
  }
  return blocks;
}

function imageSourceFromMarkdown(line: string) {
  const markdown = line.match(/^!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)\s*$/);
  if (markdown?.[1]) return markdown[1];
  const html = line.match(/\bsrc=["']([^"']+)["']/i);
  return html?.[1] ?? "";
}

function isMarkdownTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function isMarkdownListItem(line: string) {
  return /^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/.test(line);
}
