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
            .apploop-reorder-placeholder {
              box-sizing: border-box !important;
              background: rgba(56, 189, 248, 0.14) !important;
              border: 2px dashed rgba(56, 189, 248, 0.95) !important;
              border-radius: 6px !important;
              color: transparent !important;
              outline: none !important;
              box-shadow: none !important;
              pointer-events: none !important;
            }
            .apploop-reorder-placeholder * {
              visibility: hidden !important;
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
          var keyboardMoveDirty = false;
          var keyboardMoveSaveTimer = null;
          var suppressNextMouseDown = false;
          var suppressNextClick = false;
          var lastDragEvent = null;
          var selectableSelector = 'h1,h2,h3,h4,h5,h6,p,ul,ol,li,blockquote,pre,table,img,span[class*="apploop-el-"],.pill';

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
            if (tag === 'li') return 'li';
            if (tag === 'span' || (el && el.classList && el.classList.contains('pill'))) {
              var block = el.closest ? el.closest('h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table') : null;
              if (block && block !== el) tag = block.tagName.toLowerCase();
            }
            if (/^h[1-6]$/.test(tag) || /^(table|ul|ol|blockquote|pre|img)$/.test(tag)) return tag;
            return 'p';
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
            if (index < 0) return blockText(el.textContent || (el.getAttribute && el.getAttribute('alt')) || '');
            var matchingBlocks = sourceBlocks.filter(function (block) { return block.tag === tag; });
            return matchingBlocks[index] && matchingBlocks[index].text ? matchingBlocks[index].text : blockText(el.textContent || (el.getAttribute && el.getAttribute('alt')) || '');
          }

          function cssPath(el) {
            if (!(el instanceof Element)) return '';
            var parts = [];
            var node = el;
            var depth = 0;
            while (node && node.nodeType === 1 && depth < 6) {
              var tag = node.tagName.toLowerCase();
              if (tag === 'svg' || tag === 'foreignobject' || (tag === 'div' && node.classList.contains('marpit'))) break;
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

          function resolveClickTarget(raw) {
            if (!(raw instanceof Element)) return null;
            if (raw.closest && raw.closest('#apploop-inspect-box')) return null;
            var target = raw;
            var tag = target.tagName.toLowerCase();
            if (tag === 'svg' || tag === 'foreignobject') {
              var section = document.querySelector('section');
              if (section) target = section;
            }
            var table = target.closest ? target.closest('table') : null;
            if (table) return table;
            var list = target.closest ? target.closest('ul,ol') : null;
            if (list) return list;
            var quote = target.closest ? target.closest('blockquote') : null;
            if (quote) return quote;
            var fence = target.closest ? target.closest('pre') : null;
            if (fence) return fence;
            var wrapped = target.closest ? target.closest('span[class*="apploop-el-"]') : null;
            if (wrapped) return wrapped;
            var pill = target.closest ? target.closest('.pill') : null;
            if (pill) return pill;
            if (target.tagName && target.tagName.toLowerCase() === 'section') {
              var first = target.querySelector(selectableSelector + ',a,strong,em,code');
              if (first) target = first;
            }
            if (target.matches && target.matches(selectableSelector + ',a,strong,em,code')) return target;
            var nearest = target.closest ? target.closest(selectableSelector + ',a,strong,em,code') : null;
            if (nearest && nearest.tagName && !/^(body|section)$/i.test(nearest.tagName)) return nearest;
            return null;
          }

          function pathToElement(path) {
            if (!path) return null;
            try { return document.querySelector(path); } catch (e) { return null; }
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
              width: 'width', height: 'height', padding: 'padding', margin: 'margin',
              paddingLeft: 'padding-left', border: 'border', borderRadius: 'border-radius',
              borderCollapse: 'border-collapse', borderSpacing: 'border-spacing', listStyleType: 'list-style-type', opacity: 'opacity',
              fontSize: 'font-size', fontStyle: 'font-style', fontWeight: 'font-weight', lineHeight: 'line-height',
              letterSpacing: 'letter-spacing', textTransform: 'text-transform', textAlign: 'text-align',
              boxShadow: 'box-shadow', textShadow: 'text-shadow',
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

          function selectionStyleForElement(el) {
            var saved = savedStyleForElement(el);
            return Object.keys(saved).length ? saved : {};
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

          function targetId(path, tag, text) {
            return path + '::' + tag + '::' + text;
          }

          function inspectableElements() {
            var nodes = Array.prototype.slice.call(document.querySelectorAll(selectableSelector));
            var paths = [];
            return nodes.filter(function (el) {
              if (!el || !el.textContent && el.tagName.toLowerCase() !== 'img') return false;
              if (el.classList && el.classList.contains('apploop-reorder-placeholder')) return false;
              if (el.closest && el.closest('#apploop-inspect-box')) return false;
              if (cleanText(el.textContent || '').length === 0 && el.tagName.toLowerCase() !== 'img') return false;
              var tag = el.tagName.toLowerCase();
              var atomicParent = el.closest ? el.closest('blockquote,pre,table') : null;
              if (atomicParent && atomicParent !== el) return false;
              var parentPill = el.closest ? el.closest('.pill') : null;
              if (parentPill && parentPill !== el && el.matches && el.matches('span[class*="apploop-el-"]')) return false;
              if (tag === 'li' && el.closest('ul,ol')) return false;
              if ((tag === 'p' || /^h[1-6]$/.test(tag)) && el.querySelector('span[class*="apploop-el-"],.pill')) {
                var clone = el.cloneNode(true);
                Array.prototype.forEach.call(clone.querySelectorAll('span[class*="apploop-el-"],.pill'), function (child) {
                  child.remove();
                });
                if (cleanText(clone.textContent || '').length === 0) return false;
              }
              var rect = el.getBoundingClientRect();
              if (rect.width <= 0 && rect.height <= 0 && tag !== 'img') return false;
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
              width: 'width', height: 'height', padding: 'padding', margin: 'margin',
              paddingLeft: 'padding-left', border: 'border', borderRadius: 'border-radius',
              borderCollapse: 'border-collapse', borderSpacing: 'border-spacing', listStyleType: 'list-style-type', opacity: 'opacity',
              fontSize: 'font-size', fontStyle: 'font-style', fontWeight: 'font-weight', lineHeight: 'line-height',
              letterSpacing: 'letter-spacing', textTransform: 'text-transform', textAlign: 'text-align',
              boxShadow: 'box-shadow', textShadow: 'text-shadow',
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
            Object.keys(style).forEach(function (key) {
              if (isTable && (key === 'padding' || key === 'border')) return;
              setStyleProp(el, key, style[key]);
            });
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

          function applySelectedOutlines() {
            Array.prototype.forEach.call(document.querySelectorAll('.apploop-inspect-selected'), function (node) {
              node.classList.remove('apploop-inspect-selected');
              node.removeAttribute('data-active-edit');
            });
            selected.forEach(function (item) {
              var el = pathToElement(item.path);
              if (!el) return;
              el.classList.add('apploop-inspect-selected');
              if (item.id === activeId) el.setAttribute('data-active-edit', 'true');
              applyStyleToElement(el, item.style);
            });
            updatePositionBox();
          }

          function getActive() {
            return selected.find(function (item) { return item.id === activeId; }) || selected[selected.length - 1] || null;
          }

          // --- selection box chrome ---
          var box = document.createElement('div');
          box.id = 'apploop-inspect-box';
          box.innerHTML = '<div class="drag">drag</div><button class="drag-del" title="Delete element">&times;</button><div class="handle br" data-handle="br"></div><div class="handle bm" data-handle="bm"></div><div class="handle mr" data-handle="mr"></div>';
          document.body.appendChild(box);

          function setBoxOpen(open) {
            box.setAttribute('data-open', open ? 'true' : 'false');
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
            var rect = el.getBoundingClientRect();
            box.style.left = rect.left + 'px';
            box.style.top = rect.top + 'px';
            box.style.width = Math.max(8, rect.width) + 'px';
            box.style.height = Math.max(8, rect.height) + 'px';
            setBoxOpen(true);
          }

          function patchActiveStyle(partial) {
            var item = getActive();
            if (!item) return;
            item.style = Object.assign({}, item.style || {}, partial);
            var el = pathToElement(item.path);
            if (el) {
              applyStyleToElement(el, item.style);
              updatePositionBox();
            }
            emitSelectionState();
          }

          function patchItemStyle(item, partial) {
            if (!item) return;
            item.style = Object.assign({}, item.style || {}, partial);
            var el = pathToElement(item.path);
            if (el) applyStyleToElement(el, item.style);
          }

          function moveSelectedBy(dxPx, dyPx) {
            if (!selected.length) return;
            var srect = sectionBox();
            var moved = false;
            selected.forEach(function (item) {
              var el = pathToElement(item.path);
              if (!el) return;
              if (!elementCanPosition(el)) return;
              var rect = el.getBoundingClientRect();
              var currentLeftPct = ((rect.left - srect.left) / srect.width) * 100;
              var currentTopPct = ((rect.top - srect.top) / srect.height) * 100;
              var nextLeftPct = Math.max(0, Math.min(95, currentLeftPct + (dxPx / srect.width) * 100));
              var nextTopPct = Math.max(0, Math.min(95, currentTopPct + (dyPx / srect.height) * 100));
              patchItemStyle(item, {
                display: 'inline-block',
                position: 'absolute',
                left: nextLeftPct.toFixed(2) + '%',
                top: nextTopPct.toFixed(2) + '%',
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
                zIndex: '3',
              });
              moved = true;
            });
            if (!moved) return;
            scheduleKeyboardMoveSave();
            updatePositionBox();
            emitSelectionState();
          }

          function emitStyleApply(messageType) {
            window.parent.postMessage({
              type: messageType || 'apploop-presentation-style-apply',
              slide: slide,
              totalSlides: totalSlides,
              targets: selected.map(function (item) {
                return {
                  id: item.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  text: item.text,
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
              targets: selected.map(function (item) {
                return {
                  id: item.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  text: item.text,
                  path: item.path,
                  style: item.style || {},
                };
              })
            }, '*');
          }

          function toggleSelect(el, additive) {
            var path = cssPath(el);
            var tag = el.tagName.toLowerCase();
            var text = cleanText(el.textContent || '');
            var id = targetId(path, tag, text);
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
            var baseline = {};
            var style = selectionStyleForElement(el);
            var item = {
              id: id,
              path: path,
              tag: tag,
              text: text,
              style: style,
              baselineStyle: baseline,
            };
            selected = additive ? selected.concat(item) : [item];
            activeId = id;
            applySelectedOutlines();
            emitSelectionState();
          }

          function selectAllElements() {
            selected = inspectableElements().map(function (el) {
              var path = cssPath(el);
              var tag = el.tagName.toLowerCase();
              var text = cleanText(el.textContent || el.getAttribute('alt') || tag);
              return {
                id: targetId(path, tag, text),
                path: path,
                tag: tag,
                text: text,
                style: selectionStyleForElement(el),
                baselineStyle: {},
              };
            });
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
              var tag = target.tagName.toLowerCase();
              var text = cleanText(target.textContent || '');
              var id = targetId(path, tag, text);
              item = { id: id, path: path, tag: tag, text: text, style: selectionStyleForElement(target), baselineStyle: {} };
              selected = [item];
              activeId = id;
              applySelectedOutlines();
              emitSelectionState();
            }
            var previousText = target.textContent || '';
            var previousContentEditable = target.getAttribute('contenteditable');
            document.body.setAttribute('data-apploop-editing-active', 'true');
            target.setAttribute('contenteditable', 'true');
            target.setAttribute('data-apploop-editing', 'true');
            target.focus();
            var range = document.createRange();
            range.selectNodeContents(target);
            var selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
            var committed = false;
            function cleanup() {
              if (previousContentEditable === null) target.removeAttribute('contenteditable');
              else target.setAttribute('contenteditable', previousContentEditable);
              target.removeAttribute('data-apploop-editing');
              document.body.removeAttribute('data-apploop-editing-active');
              target.removeEventListener('blur', commit);
              target.removeEventListener('keydown', handleEditKeyDown);
              applySelectedOutlines();
            }
            function commit() {
              if (committed) return;
              committed = true;
              var newText = blockText(target.textContent || '');
              var previousBlockText = blockText(previousText);
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
              target.textContent = previousText;
              cleanup();
            }
            function handleEditKeyDown(e) {
              if (e.key === 'Enter') { e.preventDefault(); target.blur(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }
            target.addEventListener('blur', commit);
            target.addEventListener('keydown', handleEditKeyDown);
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

          function pointInRect(event, rect) {
            return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
          }

          function elementCanReorder(el) {
            if (!el || !el.parentElement) return false;
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (isTableOrListPart(el)) return false;
            return /^(h1|h2|h3|h4|h5|h6|p|ul|ol|blockquote|pre|table|img|span)$/.test(tag);
          }

          function isTableOrListPart(el) {
            if (!el || !el.tagName) return false;
            var tag = el.tagName.toLowerCase();
            if (/^(li|tr|td|th|thead|tbody|tfoot|col|colgroup)$/.test(tag)) return true;
            if (/^(ul|ol|table)$/.test(tag)) return false;
            return Boolean(el.closest && el.closest('li,tr,td,th,thead,tbody,tfoot,col,colgroup'));
          }

          function elementCanPosition(el) {
            return Boolean(el && !isTableOrListPart(el));
          }

          function createReorderPlaceholder(el) {
            var placeholder = el.cloneNode(true);
            var computed = window.getComputedStyle(el);
            var rect = el.getBoundingClientRect();
            placeholder.removeAttribute('id');
            placeholder.removeAttribute('data-active-edit');
            placeholder.classList.remove('apploop-inspect-selected', 'apploop-inspect-hover');
            placeholder.classList.add('apploop-reorder-placeholder');
            placeholder.setAttribute('aria-hidden', 'true');
            placeholder.style.display = computed.display === 'inline' ? 'inline-block' : computed.display;
            placeholder.style.width = rect.width + 'px';
            placeholder.style.height = rect.height + 'px';
            placeholder.style.marginTop = computed.marginTop;
            placeholder.style.marginRight = computed.marginRight;
            placeholder.style.marginBottom = computed.marginBottom;
            placeholder.style.marginLeft = computed.marginLeft;
            placeholder.style.verticalAlign = computed.verticalAlign;
            placeholder.style.flex = computed.flex;
            placeholder.style.alignSelf = computed.alignSelf;
            return placeholder;
          }

          function reorderCandidates(sourceEl, placeholder) {
            var section = document.querySelector('section');
            return inspectableElements().filter(function (candidate) {
              if (!candidate || candidate === sourceEl || candidate === placeholder) return false;
              if (!elementCanReorder(candidate)) return false;
              if (window.getComputedStyle(candidate).position === 'absolute') return false;
              if (sourceEl && (sourceEl.contains(candidate) || candidate.contains(sourceEl))) return false;
              if (placeholder && (placeholder.contains(candidate) || candidate.contains(placeholder))) return false;
              return !section || section.contains(candidate);
            });
          }

          function nearestInsertion(event, sourceEl, placeholder) {
            var previousDisplay = placeholder && placeholder.style ? placeholder.style.display : '';
            if (placeholder && placeholder.style) placeholder.style.display = 'none';
            var candidates = reorderCandidates(sourceEl, placeholder);
            var best = null;
            candidates.forEach(function (candidate) {
              var rect = candidate.getBoundingClientRect();
              var vertical = Math.abs(event.clientY - (rect.top + rect.height / 2));
              var horizontal = Math.abs(event.clientX - (rect.left + rect.width / 2));
              var distance = vertical * 4 + horizontal;
              if (!best || distance < best.distance) {
                best = {
                  el: candidate,
                  distance: distance,
                  placement: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
                };
              }
            });
            if (placeholder && placeholder.style) placeholder.style.display = previousDisplay;
            return best;
          }

          function placePlaceholder(drag, event) {
            if (!drag || !drag.placeholder || !drag.reorder) return;
            if (!pointInRect(event, drag.srect)) {
              drag.currentDrop = null;
              window.parent.postMessage({ type: 'apploop-presentation-drag-preview-clear' }, '*');
              return;
            }
            var insertion = nearestInsertion(event, drag.el, drag.placeholder);
            if (!insertion) {
              return;
            }
            if (insertion.placement === 'before') {
              insertion.el.parentElement.insertBefore(drag.placeholder, insertion.el);
            } else {
              insertion.el.parentElement.insertBefore(drag.placeholder, insertion.el.nextSibling);
            }
            drag.currentDrop = {
              tag: insertion.el.tagName.toLowerCase(),
              text: sourceTextForElement(insertion.el),
              path: cssPath(insertion.el),
              placement: insertion.placement,
            };
            window.parent.postMessage({
              type: 'apploop-presentation-drag-preview',
              slide: slide,
              totalSlides: totalSlides,
              sourceText: drag.sourceText || sourceTextForElement(drag.el),
              targetText: drag.currentDrop.text,
              targetTag: drag.currentDrop.tag,
              targetPath: drag.currentDrop.path,
              placement: drag.currentDrop.placement,
              targets: selected.map(function (item) {
                return {
                  id: item.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  text: item.text,
                  path: item.path,
                  style: item.style || {},
                };
              })
            }, '*');
          }

          function startReorderDrag(item, el, event, rect, srect) {
            if (!elementCanReorder(el)) return null;
            var sourceText = sourceTextForElement(el);
            var placeholder = createReorderPlaceholder(el);
            var shield = document.createElement('div');
            var originalParent = el.parentElement;
            if (!originalParent) return null;
            var originalNextSibling = el.nextSibling;
            var originalStyle = el.getAttribute('style');
            var originalPointerEvents = el.style.pointerEvents;
            originalParent.insertBefore(placeholder, el);
            el.style.position = 'absolute';
            el.style.boxSizing = 'border-box';
            el.style.left = (rect.left - srect.left) + 'px';
            el.style.top = (rect.top - srect.top) + 'px';
            el.style.width = rect.width + 'px';
            el.style.height = rect.height + 'px';
            el.style.margin = '0';
            el.style.zIndex = '2147483644';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.88';
            el.style.transform = 'none';
            shield.setAttribute('aria-hidden', 'true');
            shield.style.position = 'fixed';
            shield.style.inset = '0';
            shield.style.zIndex = '2147483643';
            shield.style.cursor = 'grabbing';
            shield.style.background = 'transparent';
            shield.style.touchAction = 'none';
            shield.style.userSelect = 'none';
            shield.addEventListener('mousemove', handleDragMove, true);
            shield.addEventListener('pointermove', handleDragMove, true);
            shield.addEventListener('mouseup', finishDrag, true);
            shield.addEventListener('pointerup', finishDrag, true);
            document.body.appendChild(shield);
            return {
              reorder: true,
              startX: event.clientX,
              startY: event.clientY,
              startLeft: rect.left - srect.left,
              startTop: rect.top - srect.top,
              srect: srect,
              el: el,
              item: item,
              placeholder: placeholder,
              originalParent: originalParent,
              originalNextSibling: originalNextSibling,
              originalStyle: originalStyle,
              originalPointerEvents: originalPointerEvents,
              shield: shield,
              sourceText: sourceText,
              currentDrop: null,
            };
          }

          function removeDragShield(drag) {
            if (drag && drag.shield && drag.shield.parentElement) drag.shield.parentElement.removeChild(drag.shield);
          }

          function restoreDraggedElement(drag) {
            if (!drag || !drag.reorder) return;
            if (drag.originalStyle === null) drag.el.removeAttribute('style');
            else drag.el.setAttribute('style', drag.originalStyle);
            drag.el.style.pointerEvents = drag.originalPointerEvents || '';
          }

          function cancelReorderDrag(drag) {
            if (!drag || !drag.reorder) return;
            restoreDraggedElement(drag);
            if (drag.originalParent) drag.originalParent.insertBefore(drag.el, drag.originalNextSibling);
            if (drag.placeholder && drag.placeholder.parentElement) drag.placeholder.parentElement.removeChild(drag.placeholder);
            removeDragShield(drag);
            applySelectedOutlines();
          }

          function commitReorderDrag(drag) {
            if (!drag || !drag.reorder || !drag.currentDrop || !drag.currentDrop.text) {
              cancelReorderDrag(drag);
              return false;
            }
            var placeholder = drag.placeholder;
            var parent = placeholder ? placeholder.parentElement : null;
            restoreDraggedElement(drag);
            if (parent) parent.insertBefore(drag.el, placeholder);
            if (placeholder && placeholder.parentElement) placeholder.parentElement.removeChild(placeholder);
            removeDragShield(drag);
            applySelectedOutlines();
            window.parent.postMessage({
              type: 'apploop-presentation-smart-organize-element',
              slide: slide,
              totalSlides: totalSlides,
              sourceText: drag.sourceText || sourceTextForElement(drag.el),
              targetText: drag.currentDrop.text,
              targetTag: drag.currentDrop.tag,
              targetPath: drag.currentDrop.path,
              placement: drag.currentDrop.placement,
              targets: selected.map(function (item) {
                return {
                  id: item.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: item.tag,
                  text: item.text,
                  path: item.path,
                  style: item.style || {},
                };
              })
            }, '*');
            return true;
          }

          function smartDropTarget(event, item) {
            if (!item || !event || typeof document.elementsFromPoint !== 'function') return null;
            var sourceEl = pathToElement(item.path);
            if (!elementCanPosition(sourceEl)) return null;
            var previousSourcePointerEvents = sourceEl ? sourceEl.style.pointerEvents : '';
            var previousBoxPointerEvents = box.style.pointerEvents;
            if (sourceEl) sourceEl.style.pointerEvents = 'none';
            box.style.pointerEvents = 'none';
            var elements = document.elementsFromPoint(event.clientX, event.clientY);
            if (sourceEl) sourceEl.style.pointerEvents = previousSourcePointerEvents;
            box.style.pointerEvents = previousBoxPointerEvents;
            for (var i = 0; i < elements.length; i += 1) {
              var raw = elements[i];
              if (!raw || raw.closest && raw.closest('#apploop-inspect-box')) continue;
              var target = resolveClickTarget(raw);
              if (!target || target === sourceEl || (sourceEl && sourceEl.contains(target))) continue;
              if (!elementCanReorder(target)) continue;
              var text = sourceTextForElement(target);
              if (!text || text === item.text) continue;
              var tag = target.tagName ? target.tagName.toLowerCase() : '';
              if (!/^(h1|h2|h3|h4|h5|h6|p|ul|ol|blockquote|table|span|strong|em|code)$/.test(tag)) continue;
              var rect = target.getBoundingClientRect();
              return {
                tag: tag,
                text: text,
                path: cssPath(target),
                placement: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
              };
            }
            return null;
          }

          function beginBoxGesture(event) {
            var item = getActive();
            if (!item) return;
            var el = pathToElement(item.path);
            if (!el) return;
            if (!elementCanPosition(el)) return;
            var handle = event.target && event.target.getAttribute ? event.target.getAttribute('data-handle') : null;
            var rect = el.getBoundingClientRect();
            var srect = sectionBox();
            if (handle) {
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
              };
            } else {
              dragging = startReorderDrag(item, el, event, rect, srect) || {
                startX: event.clientX,
                startY: event.clientY,
                startLeft: rect.left - srect.left,
                startTop: rect.top - srect.top,
                srect: srect,
                el: el,
                item: item,
              };
              if (dragging.reorder) placePlaceholder(dragging, event);
              if (dragging.reorder) window.parent.postMessage({ type: 'apploop-presentation-drag-start' }, '*');
            }
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
              var leftPx = dragging.startLeft + dx;
              var topPx = dragging.startTop + dy;
              if (dragging.reorder) {
                dragging.el.style.left = leftPx + 'px';
                dragging.el.style.top = topPx + 'px';
                placePlaceholder(dragging, event);
                updatePositionBox();
                return;
              }
              var leftPct = Math.max(0, Math.min(95, (leftPx / dragging.srect.width) * 100));
              var topPct = Math.max(0, Math.min(95, (topPx / dragging.srect.height) * 100));
              patchActiveStyle({
                display: 'inline-block',
                position: 'absolute',
                left: leftPct.toFixed(2) + '%',
                top: topPct.toFixed(2) + '%',
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
                zIndex: '3',
              });
            }
            if (resizing) {
              var rdx = event.clientX - resizing.startX;
              var rdy = event.clientY - resizing.startY;
              var w = Math.max(24, resizing.startW + (resizing.handle === 'bm' ? 0 : rdx));
              var h = Math.max(16, resizing.startH + (resizing.handle === 'mr' ? 0 : rdy));
              patchActiveStyle({
                display: 'inline-block',
                position: 'absolute',
                width: Math.round(w) + 'px',
                height: Math.round(h) + 'px',
                zIndex: '3',
              });
            }
          }

          window.addEventListener('mousemove', handleDragMove, true);
          document.addEventListener('mousemove', handleDragMove, true);
          window.addEventListener('pointermove', handleDragMove, true);
          document.addEventListener('pointermove', handleDragMove, true);

          function finishDrag(event) {
            event = event && event.clientX !== undefined ? event : lastDragEvent || event;
            var didGesture = Boolean(dragging || resizing);
            var wasReorder = Boolean(dragging && dragging.reorder);
            var reorderCommitted = dragging && dragging.reorder ? commitReorderDrag(dragging) : false;
            var dragItem = dragging && !dragging.reorder ? dragging.item : null;
            var dropTarget = dragging && !dragging.reorder ? smartDropTarget(event, dragItem) : null;
            dragging = null;
            resizing = null;
            lastDragEvent = null;
            if (wasReorder) window.parent.postMessage({ type: 'apploop-presentation-drag-end' }, '*');
            if (reorderCommitted) return;
            if (wasReorder) return;
            if (dropTarget && dragItem) {
              window.parent.postMessage({
                type: 'apploop-presentation-smart-organize-element',
                slide: slide,
                totalSlides: totalSlides,
                sourceText: dragItem.text,
                targetText: dropTarget.text,
                targetTag: dropTarget.tag,
                targetPath: dropTarget.path,
                placement: dropTarget.placement,
                targets: selected.map(function (item) {
                  return {
                    id: item.id,
                    slide: slide,
                    totalSlides: totalSlides,
                    tag: item.tag,
                    text: item.text,
                    path: item.path,
                    style: item.style || {},
                  };
                })
              }, '*');
              return;
            }
            if (didGesture) {
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
              if (dragging && dragging.reorder) {
                cancelReorderDrag(dragging);
                dragging = null;
                lastDragEvent = null;
                window.parent.postMessage({ type: 'apploop-presentation-drag-preview-clear' }, '*');
                window.parent.postMessage({ type: 'apploop-presentation-drag-end' }, '*');
                event.preventDefault();
                event.stopPropagation();
                return;
              }
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
            if (!event.shiftKey && selected.length === 1 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              if (swapActiveBlock(event.key === 'ArrowUp' ? 'up' : 'down')) return;
            }
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

          function swapActiveBlock(direction) {
            var item = getActive();
            if (!item) return false;
            var el = pathToElement(item.path);
            if (!el) return false;
            if (!elementCanReorder(el)) return false;
            if (window.getComputedStyle(el).position === 'absolute') return false;
            var flow = inspectableElements().filter(function (candidate) {
              return elementCanReorder(candidate) && window.getComputedStyle(candidate).position !== 'absolute';
            });
            var index = flow.indexOf(el);
            if (index === -1) return false;
            var neighbor = flow[direction === 'up' ? index - 1 : index + 1];
            if (!neighbor) return true;
            var sourceText = sourceTextForElement(el);
            var targetText = sourceTextForElement(neighbor);
            if (!sourceText || !targetText || sourceText === targetText) return true;
            // Immediate visual swap; the saved Markdown reload confirms it.
            if (direction === 'up') neighbor.parentElement.insertBefore(el, neighbor);
            else neighbor.parentElement.insertBefore(el, neighbor.nextSibling);
            updatePositionBox();
            window.parent.postMessage({
              type: 'apploop-presentation-smart-organize-element',
              slide: slide,
              totalSlides: totalSlides,
              sourceText: sourceText,
              targetText: targetText,
              placement: direction === 'up' ? 'before' : 'after',
              keepSelection: true,
              targets: selected.map(function (target) {
                return {
                  id: target.id,
                  slide: slide,
                  totalSlides: totalSlides,
                  tag: target.tag,
                  text: target.text,
                  path: target.path,
                  style: target.style || {},
                };
              })
            }, '*');
            return true;
          }

          window.addEventListener('message', function (event) {
            var data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'apploop-presentation-set-selections') {
              var incoming = Array.isArray(data.targets) ? data.targets : [];
              selected = incoming.map(function (t) {
                var path = t.path;
                var resolved = pathToElement(path);
                if (!resolved || cleanText(resolved.textContent || '') !== t.text) {
                  var replacement = inspectableElements().find(function (candidate) {
                    return candidate.tagName.toLowerCase() === t.tag && cleanText(candidate.textContent || '') === t.text;
                  });
                  if (replacement) path = cssPath(replacement);
                }
                return {
                  id: t.id || targetId(path, t.tag, t.text),
                  path: path,
                  tag: t.tag,
                  text: t.text,
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
              if (data.swap && selected.length === 1 && moveDy !== 0 && swapActiveBlock(moveDy < 0 ? 'up' : 'down')) {
                // handled as a block swap
              } else {
                moveSelectedBy(Number(data.dxPx) || 0, moveDy);
              }
            }
            if (data.type === 'apploop-presentation-drag-move') {
              var syntheticMove = { clientX: Number(data.clientX) || 0, clientY: Number(data.clientY) || 0 };
              handleDragMove(syntheticMove);
            }
            if (data.type === 'apploop-presentation-finish-drag') {
              finishDrag(lastDragEvent || {});
            }
            if (data.type === 'apploop-presentation-focus-target' && data.id) {
              activeId = data.id;
              applySelectedOutlines();
            }
            if (data.type === 'apploop-presentation-request-delete-active') {
              var item = getActive();
              if (!item) return;
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
              var el = pathToElement(target.path);
              if (el) applyStyleToElement(el, data.style || {});
              updatePositionBox();
              emitSelectionState();
            }
            if (data.type === 'apploop-presentation-apply-all-styles') {
              data.targets.forEach(function (patchTarget) {
                var target = selected.find(function (item) { return item.id === patchTarget.id; });
                if (!target) return;
                target.style = Object.assign({}, patchTarget.style || {});
                var el = pathToElement(target.path);
                if (el) applyStyleToElement(el, target.style);
              });
              updatePositionBox();
              emitSelectionState();
            }
          });

          window.addEventListener('resize', updatePositionBox);

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

function isMarkdownTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function isMarkdownListItem(line: string) {
  return /^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/.test(line);
}
