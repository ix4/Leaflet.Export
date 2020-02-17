(function (L, undefined) {
  /**
   * Base namespace for measurement tools.
   */
  L.Measure = L.Class.extend({
    initialize: function (map, options) {
      this._map = map;
      options = options || {};
      options.editOptions = options.editOptions || {};
      this.options = options;
      if (!this._map.editTools) {
        this._map.editTools = new L.Editable(map, options.editOptions);
      }

      if (!this._map.measureTools) {
        this._map.measureTools = this;
      }
      this.markerTool = L.Measure.marker(map, {});
      this.circleTool = L.Measure.circle(map, {});
      this.rectangleTool = L.Measure.rectangle(map, {});
      this.polylineTool = L.Measure.polyline(map, {});
      this.polygonTool = L.Measure.polygon(map, {});
    },

    getEditTools: function () {
      return this._map.editTools;
    },

    getMeasureLayerGroup: function () {
      //       return this._map._measureLayerGroup;
      this._map.editTools.featuresLayer;
    },

    stopMeasuring: function () {
      this.markerTool.stopMeasure();
      this.circleTool.stopMeasure();
      this.rectangleTool.stopMeasure();
      this.polylineTool.stopMeasure();
      this.polygonTool.stopMeasure();
    }
  });

  /*
   The factory method for creating the base instance.
   */
  L.measure = function (map, options) {
    return new L.Measure(map, options);
  };

  L.Measure.imagePath = (function () {
    var scripts = document.getElementsByTagName('script'),
      leafletRe = /[\/^]leaflet_measure\.js\??/;


    var i, len, src, path;

    for (i = 0, len = scripts.length; i < len; i++) {
      src = scripts[i].src || '';

      if (src.indexOf('ember') >= 0) {
        return '/assets/images';
      } else {
        if (src.match(leafletRe)) {
          path = src.split(leafletRe)[0];
          return (path ? path + '../../' : '') + 'images';
        }
      }
    }
  }());

  /**
   * An admixture that overrides the basic methods of the Leaflet.Editable plugin tools, turning them into measurement tools.
   */
  L.Measure.Mixin = {

    /**
     * The number of characters after the decimal separator for measurements in meters.
     */
    precision: 2,

    /**
    Initializes a new measurement tool.
    @param {Object} map Card used.
     */
    initialize: function (map, options) {
      this._map = map;
      this.setEvents();
    },

    setPrecition: function (precision) {
      this.precision = precision;
    },

    stopMeasure: function () {
      this._hideMouseMarker();

      this._map.editTools.stopDrawing();
    },

    _setMouseMarker: function () {
      if (typeof this._map._mouseMarker === 'undefined') {
        var tooltipOptions = {
          sticky: true,
          pane: 'popupPane',
          className: 'leaflet-draw-tooltip'
        };
        var imagePath = L.Measure.imagePath;
        var popupMarkerIcon = L.icon({
          iconUrl: imagePath + '/popupMarker.png',
          iconSize: [1, 1]
        });
        this._map._mouseMarker = L.marker(this._map.getCenter());
        this._map._mouseMarker.setIcon(popupMarkerIcon);
        this._map._mouseMarker.addTo(this._map);
        this._map._mouseMarker.bindTooltip('', tooltipOptions);
      }
    },

    _hideMouseMarker: function () {
      var mouseMarker = this._map._mouseMarker;
      if (typeof mouseMarker !== 'undefined') {
        mouseMarker.closeTooltip();
      }
    },

    _getLabelContent: function (layer, latlng) {
      return '';
    },

    _labelledMarkers: function (editor) {
      return [];
    },

    _unlabelledMarkers: function (editor) {
      return [];
    },

    /**
      Method for updating labels containing measurement results.
      @param {Object} e Event.
      @param {Object} layer Editable layer.
      */
    _updateLabels: function (e) {
      var layer = e.layer;
      var editor = layer.editor;
      var unlabelledMarkers = this._unlabelledMarkers(editor, e);
      for (var i = 0; i < unlabelledMarkers.length; i++) {
        var marker = unlabelledMarkers[i];
        if (marker && marker.getTooltip()) {
          marker.closeTooltip();
        }
      }
      var labelledMarkers = this._labelledMarkers(editor, e);
      for (var i = 0; i < labelledMarkers.length; i++) {
        var marker = labelledMarkers[i];
        var latlng = marker.latlng;
        var labelText = this._getLabelContent(layer, latlng, e);
        this._showLabel(marker, labelText, latlng);
      }

      //Update tooltip of the measured object
      this._updateMeasureLabel(layer, e);
    },

    _showLabel: function (marker, labelText, latlng) {
      if (!marker.getTooltip()) {
        marker.bindTooltip(labelText, {
          permanent: true,
          opacity: 0.75
        }).addTo(this._map);
      } else {
        marker.setTooltipContent(labelText);
      }
      if (latlng) {
        marker._tooltip.setLatLng(latlng);
      }
      marker.openTooltip();
    },

    /**
    Method for updating the main label of the measured object
    @param {Object} layer Editable layer.
    */
    _updateMeasureLabel: function (layer, e) {},


    /**
      The handler of the event that signals the movement of the mouse cursor during drawing measurements.
      @param {String} text The text to display.
      */
    _onMouseMove: function (e, text) {
      this._showPopup(text, e.latlng);
    },

    _showPopup: function (text, latlng) {
      this._map._mouseMarker.setTooltipContent(text);
      if (!this._map._mouseMarker.isTooltipOpen()) {
        this._map._mouseMarker.openTooltip();
      }
      this._map._mouseMarker.setLatLng(latlng);
    },

    _closePopup: function () {
      this._map._mouseMarker.closeTooltip();
    },


    _setMeasureEventType: function (e, type) {
      e._measureEventType = type;
    },

    _getMeasureEventType: function (e) {
      return e._measureEventType;
    },

    /**
    An event handler that signals layer editing.
     */
    _fireEvent: function (e, type) {
      var layer = e.layer;
      var layerType = this._layerType(layer);
      var measureEvent = 'measure:' + type;
      this._setMeasureEventType(e, measureEvent);
      if (type === 'created') {
        //         this._map._measureLayerGroup.addLayer(layer);
        layer.on('remove', function (e) {
          this.disableEdit();
        });
      }
      if (type !== 'move') {
        this._updateLabels(e);
      }

      this._map.fire(measureEvent, {
        e: e,
        measurer: this,
        layer: layer,
        layerType: layerType
      });
      return true;
    },

    _layerType: function (layer) {
      var layerType;
      if (layer instanceof L.Marker) {
        layerType = 'Marker';
      } else if (layer instanceof L.Circle) {
        layerType = 'Circle';
      } else if (layer instanceof L.Rectangle) {
        layerType = 'Rectangle';
      } else if (layer instanceof L.Polygon) {
        layerType = 'Polygon';
      } else if (layer instanceof L.Polyline) {
        layerType = 'Polyline';
      } else {
        layerType = 'unknown';
      }
      return layerType;
    },

    eventsOn: function (prefix, eventTree, offBefore) {
      for (var eventSubName in eventTree) {
        var func = eventTree[eventSubName];
        var eventName = prefix + eventSubName;
        if (typeof func == 'function') {
          if (!!offBefore) {
            this.measureLayer.off(eventName);
          }
          this.measureLayer.on(eventName, func, this);
        } else {
          this.eventsOn(eventName + ':', func, offBefore);
        }
      }
    },

    eventsOff: function (prefix, eventTree) {
      for (var eventSubName in eventTree) {
        var func = eventTree[eventSubName];
        var eventName = prefix + eventSubName;
        if (typeof func == 'function' && this.measureLayer) {
          this.measureLayer.off(eventName);
        } else {
          this.eventsOff(eventName + ':', func);
        }
      }
    }
  };

  /**
  Mixins for methods of working with objects
  The mixin tree repeats the Leaflet 1.0.0-rc3 feature class tree
  L.Layer +-> L.Marker
          +-> L.Path +-> L.Polyline -> L.Polygon -> L.Rectangle
                     +->L.CircleMarker -> L.Circle
   */

  /**
    Admixture providing support for basic marker editing methods
  */
  L.Measure.Mixin.Marker = {

    distanceMeasureUnit: {
      meter: ' m',
      kilometer: ' km'
    },

    /**
      It leads the value of the coordinates of the point, which can take any real value,
      to the values lying in the segments [-90; 90], for latitude, [-180, 180] for longitude.
      @param {Object} latlng Point containing coordinates.
      @returns {Number} Point with adjusted coordinates.
    */
    getFixedLatLng: function (latlng) {
      var getFixedCoordinate = function (coordinate, periodRadius) {
        var divCoordinate = Math.floor(Math.abs(coordinate) / periodRadius);
        var fixCoefficient = divCoordinate % 2 ? (divCoordinate + 1) : divCoordinate;

        return (coordinate >= 0) ? coordinate - (periodRadius * fixCoefficient) : coordinate + (periodRadius * fixCoefficient);
      };

      return L.latLng(getFixedCoordinate(latlng.lat, 90), getFixedCoordinate(latlng.lng, 180));
    },

    /**
      Get a textual representation of the measurements taken.
      @param {Object} e Method arguments.
      @param {Object} e.value Measurement result in meters.
      @param {Object} e.dimension Dimension of measurements (1 - linear distances, 2 - areas).
      @returns {string} Textual representation of the measurements taken.
    */
    getMeasureText: function (e) {
      var value = parseFloat(e.value.toFixed(this.precision));
      var metersInOneKm = Math.pow(1000, e.dimension);
      var kmPrecition = this.precision + e.dimension * 3;
      var valueInKm = parseFloat((value / metersInOneKm).toFixed(kmPrecition));

      var dimensionText = (e.dimension > 1) ? '<sup>' + e.dimension + '</sup>' : '';
      var kmRoundingBound = 1.0 / Math.pow(10, e.dimension - 1);

      return (valueInKm >= kmRoundingBound) ?
        valueInKm.toFixed(kmPrecition) + this.distanceMeasureUnit.kilometer + dimensionText :
        value.toFixed(this.precision) + this.distanceMeasureUnit.meter + dimensionText;
    },

    /**
      Calculates the distance between two points (in meters) with a given accuracy.
      @param {Object} e Arguments of the method.
      @param {Object} e.latlng1 First point.
      @param {Object} e.latlng2 Second point.
      @returns {Number} Received distance (in meters).
    */
    getDistance: function (e) {
      return parseFloat(e.latlng1.distanceTo(e.latlng2).toFixed(this.precision));
    },

    /**
      Calculates the distance between two points and returns its textual representation with the given precision.
      @param {Object} e Arguments of the method.
      @param {Object} e.latlng1 First point.
      @param {Object} e.latlng2 Second point.
      @returns {String} Textual representation of distance.
    */
    getDistanceText: function (e) {
      return this.getMeasureText({
        value: this.getDistance(e),
        dimension: 1
      });
    },

  };

  /**
    (TRANSLATED) Admixture providing support for basic path editing methods
  */
  L.Measure.Mixin.Path = {

    getLatLngs: function (layer) {
      return layer.editor.getLatLngs();
    },

    /**
       Method for getting the number of vertices of a shape
       @param {Object} layer Layer with geometry representing the measurements.
       @returns {Number} The number of vertices.
    */
    numberOfVertices: function (layer) {
      return this.getLatLngs(layer).length;
    },

    /**
      Method for getting perimeter of layer points
      @param {Object} layer Layer with geometry representing the measurements.
      @returns {Number} Perimeter.
    */
    _getPerimeter: function (latlngs) {
      var distance = 0;
      var currentInc = 0;
      for (var i = 1; i < latlngs.length; i++) {
        var prevLatLng = latlngs[i - 1];
        var currentLatLng = latlngs[i];
        currentInc = this.getDistance({
          latlng1: prevLatLng,
          latlng2: currentLatLng
        });
        distance += currentInc;
      }

      return distance;
    },

    /**
      Метод для получения периметра точек слоя
      @param {Object} layer Слой с геометрией, представляющей производимые измерения.
      @returns {Number} Периметр.
    */
    getPerimeter: function (layer) {
      var latlngs = this.getLatLngs(layer);
      distance = this._getPerimeter(latlngs);

      return distance;
    },

    /**
      Method for getting perimeter of layer points
      @param {Object} layer Layer with geometry representing the measurements.
      @returns {Number} String} The textual representation of the perimeter.
    */
    getPerimeterText: function (layer) {
      return this.getMeasureText({
        value: this.getPerimeter(layer),
        dimension: 1
      });
    },

  };

  /**
    An admixture that provides support for basic polyline editing methods
  */
  L.Measure.Mixin.Polyline = {};

  /**
    Admixture providing support for basic polygon editing techniques
  */
  L.Measure.Mixin.Polygon = {


    getLatLngs: function (layer) {
      return layer.editor.getLatLngs()[0];
    },

    /**
      Method for getting perimeter of layer points
      @param {Object} layer Layer with geometry representing the measurements.
      @returns {Number} Perimeter.
    */
    getPerimeter: function (layer) {
      var latlngs = this.getLatLngs(layer).slice();
      latlngs.push(latlngs[0]);
      distance = this._getPerimeter(latlngs);

      return distance;
    },

    /**
     * Calculates the area of the polygon (in meters) with the given accuracy.
     * @param {Object} layer Layer with geometry representing the measurements.
     * @param {Object} latlng Point.
     * @returns {Number} Polygon area (in meters).
     */
    getArea: function (layer, latlng) {
      var latlngs = this.getLatLngs(layer).slice();
      if (latlng) {
        latlngs.push(latlng);
      }

      return distance = parseFloat(this.geodesicArea(latlngs).toFixed(this.precision));
    },

    /**
      Calculates the area of a polygon; returns its textual representation with the given precision.
      @param {Object} layer Layer with geometry representing the measurements.
      @param {Object} latlng Point.
      @returns {Number} Text representation of the area.
    */
    getAreaText: function (layer, latlng) {
      return this.getMeasureText({
        value: this.getArea(layer, latlng),
        dimension: 2
      });
    },

    /**
      Calculates the area of a polygon according to release https://github.com/openlayers/openlayers/blob/master/lib/OpenLayers/Geometry/LinearRing.js#L270*
      Perhaps requires improvements for polygons with intersecting faces and composite polygons with holes (Holes)
      @param {Object} latLngs  An array of polygon points.
      @returns {Number} Polygon area (in meters).
    */
    geodesicArea: function (latLngs) {
      const DEG_TO_RAD = 0.017453292519943295;;
      var pointsCount = latLngs.length,
        area = 0.0,
        d2r = DEG_TO_RAD,
        p1, p2;

      if (pointsCount > 2) {
        for (var i = 0; i < pointsCount; i++) {
          p1 = latLngs[i];
          p2 = latLngs[(i + 1) % pointsCount];
          area += ((p2.lng - p1.lng) * d2r) *
            (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
        }
        area = area * 6378137.0 * 6378137.0 / 2.0;
      }

      return Math.abs(area);
    },

  };

  /**
    Admixture providing support for basic rectangle editing methods
  */
  L.Measure.Mixin.Rectangle = {};

  /**
    Admixture providing support for basic rectangle editing methods
  */
  L.Measure.Mixin.CircleMarker = {};

  /**
    Admixture providing support for basic circle measurement methods
  */
  L.Measure.Mixin.Circle = {

    /**
      Returns the textual representation for the radius with the specified precision.
      @param {Object} layer Layer with geometry representing the measurements.
      @returns {Number} The textual representation of the radius.
    */
    getRadiusText: function (layer) {
      var radius = layer.getRadius();
      if (radius < 0) return '';
      return this.getMeasureText({
        value: radius,
        dimension: 1
      });
    },

    /**
      Returns a textual representation for the diameter with the specified precision.
      @param {Object} layer Layer with geometry representing the measurements.
      @returns {String} The textual representation of the diameter.
    */
    getDiameterText: function (layer) {
      return this.getMeasureText({
        value: 2 * layer.getRadius(),
        dimension: 1
      });
    },

    /**
      Returns the textual representation for the perimeter with the specified precision.
      TODO: LEARNING SPHERICALITY - MAYBE WANT TO TRANSFER TO A MULTIPOON?
      @param {Object} layer Layer with geometry representing the measurements.
      @returns {String} The textual representation of the perimeter.
    */
    getPerimeterText: function (layer) {
      return this.getMeasureText({
        value: 2 * Math.PI * layer.getRadius(),
        dimension: 1
      });
    },



    /**
    Returns a textual representation of the area of a circle with the specified precision.
    TODO - LEARNING SPHERICALITY - MAYBE IT WANT TO TRANSFER TO A MULTIDAGON?
    @param {Object} e Arguments of the method.
    @param {Object} e.radius The value of the radius in meters.
    @returns {Number} The textual representation of the radius.
      */
    getAreaText: function (layer) {
      var radius = layer.getRadius();
      var area = Math.PI * radius * radius;
      return this.getMeasureText({
        value: area,
        dimension: 2
      });
    },
  };

  /**
   Admixture providing support for marker measurement events
   */
  L.Measure.Mixin.MarkerEvents = {
      /**
      A method that ensures at the time of initialization the capture of the main editing events

      Order of events in Leaflet.Editable:

        Until the first click
          editable:created
          editable:enable
          editable:drawing:start
          editable:drawing:move

        1st click and subsequent clicks
          editable:created
          editable:drawing:mousedown
          editable:drawing:click
          editable:drawing:clicked
          editable:drawing:commit
          editable:drawing:end
        Drag the top:

          editable:editing
          editable:dragstart
          editable:drag
          editable:dragend
     */
      setEvents: function (map, options) {
        this.editableEventTree = {
          drawing: {
            move: this._setMove,
            commit: this._setCommit,
          },
          drag: this._setDrag,
          dragstart: this._setDragStart,
          dragend: this._setDragend
        };
      },

      _setMove: function (e) {
        if (this.isDragging && this.measureLayer.getTooltip() && this.measureLayer.isTooltipOpen()) {
          this.measureLayer.closeTooltip();
        }

        var text = this.isDragging ? this.popupText.drag : this.popupText.move;
        var labelContent = this._getLabelContent(e.layer, e.latlng).trim();
        if (labelContent.length > 0) {
          text += '<br>' + labelContent;
        }

        this._onMouseMove(e, text);
        this._fireEvent(e, 'move');
      },

      _setDrag: function (e) {
        this._fireEvent(e, 'edit:drag');
      },

      _setDragStart: function (e) {
        if (e.layer.getTooltip()) {
          e.layer.closeTooltip();
        }

        this.isDragging = true;
      },

      _setDragend: function (e) {
        this._closePopup();
        if (this.measureLayer.getTooltip() && !this.measureLayer.isTooltipOpen()) {
          this.measureLayer.openTooltip();
        }

        this.isDragging = false;
        this._fireEvent(e, 'editend');
        e.layer.openTooltip();
      },

      _setCommit: function (e) {
        this._closePopup();
        this._fireEvent(e, 'created');
      },
    },

    /**
      A class that provides support for major marker editing events
    */
    L.Measure.Marker = L.Class.extend({
      includes: [L.Measure.Mixin, L.Measure.Mixin.Marker, L.Measure.Mixin.MarkerEvents],

      popupText: {
        move: 'Click on the map to fix the marker',
        drag: 'Release the mouse button to lock the marker.'
      },

      /**
        Initialize Marker Movement Mode
      */
      startMeasure: function (options) {
        this._setMouseMarker();
        var imagePath = L.Measure.imagePath;
        this.options = {
          icon: L.icon({
            iconUrl: imagePath + '/marker-icon.png',
            iconRetinaUrl: imagePath + '/marker-icon-2x.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: imagePath + '/marker-shadow.png',
            shadowSize: [41, 41]
          })
        };

        options = options ? L.setOptions(this, options) : this.options;
        this.measureLayer = this._map.editTools.startMarker(undefined, options);
        this.eventsOn('editable:', this.editableEventTree, true);
        this.isDragging = false;
      }
    });

  /**
    Impurity providing support for circle and rectangle measurement events
  */
  L.Measure.Mixin.CircleRectangleEvents = {
    /**
      A method that ensures at the time of initialization the capture of the main editing events

      Order of events in Leaflet.Editable:
      Until the first click
          editable:enable
          editable:drawing:start
          editable:drawing:move
        1st click
        editable:drawing:mousedown
          editable:drawing:commit
          editable:drawing:end
        Move, resize circle
          editable:vertex:dragstart
          editable:drawing:move
          editable:vertex:drag
          editable:editing
        Key Release
        editable:vertex:dragendmeasureLayer
    */
    setEvents: function (map, options) {
      this.editableEventTree = {
        drawing: {
          move: this._setMove,
          end: this._setDrawingEnd
        },
        vertex: {
          dragstart: this._setDragstart,
          drag: this._setDrag,
          dragend: this._setDragend
        }
      };
    },

    _setMove: function (e) {
      if (!this.create && !this.isDragging) {
        var text = this.popupText.move;
        var labelContent = this._getLabelContent(e.layer, e.latlng).trim();
        if (labelContent.length > 0) {
          text += '<br>' + labelContent;
        }

        this._onMouseMove(e, text);
        this._fireEvent(e, 'move');
      }
    },

    _setDrawingEnd: function (e) {
      this.create = true;
      this._fireEvent(e, 'create');
    },

    _setDragstart: function (e) {
      if (e.vertex.getTooltip()) {
        e.vertex.closeTooltip();
      }

      this.isDragging = true;
    },

    _setDragend: function (e) {
      this._closePopup();
      if (this.create) {
        this._fireEvent(e, 'created');
        this.create = false;
      } else {
        this._fireEvent(e, 'editend');
      }

      this.create = false;
      this.isDragging = false;
      e.vertex.openTooltip();
    },

    _setDrag: function (e) {
      var text = this.popupText.drag;
      var labelContent = this._getLabelContent(e.layer, e.latlng).trim();
      if (labelContent.length > 0) {
        text += '<br>' + labelContent;
      }

      this._onMouseMove(e, text);
      if (this.create) {
        this._fireEvent(e, 'create:drag');
      } else {
        this._fireEvent(e, 'edit:drag');
      }

    },
  };

  /**
   A class that provides support for major circle editing events
   */
  L.Measure.Circle = L.Class.extend({
    includes: [L.Measure.Mixin, L.Measure.Mixin.Marker, , L.Measure.Mixin.Path, L.Measure.Mixin.CircleMarker, L.Measure.Mixin.Circle, L.Measure.Mixin.CircleRectangleEvents],

    popupText: {
      move: 'Hold down the mouse button and move the cursor to draw a circle',
      drag: 'Release the mouse button to lock the circle.'
    },

    options: {
      stroke: true,
      color: 'green',
      weight: 2,
      opacity: 0.5,
      fill: true,
    },

    startMeasure: function (options) {
      this._setMouseMarker();
      options = options || this.options;
      this.measureLayer = this._map.editTools.startCircle(undefined, options);
      this.measureLayer.setRadius(-1);
      this.eventsOn('editable:', this.editableEventTree, true);
      this.create = false;
      this.isDragging = false;
    }
  });

  /**
   A class that provides support for basic rectangle editing events.
   */
  L.Measure.Rectangle = L.Class.extend({
    includes: [L.Measure.Mixin,
      L.Measure.Mixin.Marker, L.Measure.Mixin.Path, L.Measure.Mixin.Polyline, L.Measure.Mixin.Polygon, L.Measure.Mixin.Rectangle,
      L.Measure.Mixin.CircleRectangleEvents
    ],

    popupText: {
      move: 'Hold down the mouse button and move the cursor to draw a rectangle',
      drag: 'Release the mouse button to fix the rectangle.'
    },

    options: {
      stroke: true,
      color: 'green',
      weight: 2,
      opacity: 0.5,
      fill: true,
    },

    startMeasure: function (options) {
      this._setMouseMarker();
      options = options ? L.setOptions(this, options) : this.options;
      this.measureLayer = this._map.editTools.startRectangle(undefined, options);
      this.eventsOn('editable:', this.editableEventTree, true);
      this.create = false;
      this.isDrawing = false;
    }
  });

  /**
  Impurity providing support for polyline and polygon measurement events
  */
  L.Measure.Mixin.PolylinePolygonEvents = {
    /**
      A method that ensures at the time of initialization the capture of the main editing events

      Order of events in Leaflet.Editable:
        Until the first click
          editable:enable
          editable:shape:new
          editable:drawing:start
          editable:drawing:move
        1st click and subsequent clicks
          editable:drawing:mousedown
          editable:drawing:click
          editable:editing
          editable:drawing:clicked
        Commit:
          editable:vertex:mousedown
          editable:vertex:click
          editable:vertex:clicked
          editable:drawing:commit
          editable:drawing:end
        Drag the top:
          editable:vertex:dragstart
          editable:drawing:move
          editable:vertex:dragend
        Removing a vertex:
          editable:vertex:click
          editable:vertex:rawclick_closePopup
          editable:vertex:deleted
          editable:vertex:clicked
        Drag the middle marker
        editable:middlemarker:mousedown
        editable:vertex:dragstart
        editable:drawing:move
        editable:vertex:dragend
    */
    setEvents: function (map, options) {
      this.editableEventTree = {
        vertex: {
          dragstart: this._setDragStart,
          drag: this._setDrag,
          dragend: this._setDragEnd,
          deleted: this.setVertexDeleted
        },
        drawing: {
          move: this._setMove,
          clicked: this._setClicked,
          commit: this._setCommit,
          mousedown: this._setMouseDown,
          end: this.disable
        }
      };
    },

    _setMove: function (e) {
      var text;
      var nPoints = this.numberOfVertices(e.layer);
      if (nPoints == 0) {
        text = this.popupText.move;
        this._fireEvent(e, 'move');
      } else {
        if (!this.isDragging) {
          text = this.popupText.add;
          var labelContent = this._getLabelContent(e.layer, e.latlng, e).trim();
          if (labelContent.length > 0) {
            text += '<br>' + labelContent;
            this._fireEvent(e, 'create:drag');
          }
        }
      }

      this._onMouseMove(e, text);
    },

    _setDragStart: function (e) {
      if (e.vertex.getTooltip()) {
        e.vertex.closeTooltip();
      }

      this.measureLayer = e.layer;
      this.isDragging = true;
    },
    _setDragEnd: function (e) {
      this._closePopup();
      this._fireEvent(e, 'editend');
      this.isDragging = false;
      if (e.vertex.getTooltip()) {
        e.vertex.openTooltip();
      }
    },

    _setDrag: function (e) {
      var text = this.popupText.drag;
      var labelContent = this._getLabelContent(e.layer, e.vertex.latlng).trim();
      if (labelContent.length > 0) {
        text += '<br>' + labelContent;
      }

      this._onMouseMove(e, text);
      this._fireEvent(e, 'edit:drag');
    },

    setVertexDeleted: function (e) {
      this.vertexDeleted = true;
      this._fireEvent(e, 'edit');
      this._fireEvent(e, 'editend');
      this.vertexDeleted = false;
    },

    _setMouseDown: function (e) {
      if (this.numberOfVertices(e.layer) <= 1) {
        return;
      }

      var text = this.popupText.commit;
      var latlng = e.latlng ? e.latlng : e.vertex.latlng;
      this._showPopup(text, latlng);
    },

    _setClicked: function (e) {
      this._fireEvent(e, 'create');
      if (this.numberOfVertices(e.layer) <= 2) {
        return;
      }

      var text = this.popupText.commit;
      var latlng = e.latlng ? e.latlng : e.vertex.latlng;
      this._showPopup(text, latlng);
    },

    _setCommit: function (e) {
      this._closePopup();
      this._fireEvent(e, 'created');
    },
  };

  /**
    A class that provides support for major events editing a polyline
  */
  L.Measure.Polyline = L.Class.extend({
    includes: [L.Measure.Mixin, L.Measure.Mixin.Marker, L.Measure.Mixin.Path, L.Measure.Mixin.Polyline, L.Measure.Mixin.PolylinePolygonEvents],

    popupText: {
      move: 'Click on the map to add the starting vertex.',
      add: 'Click on the map to add a new vertex.',
      commit: 'Click on the current vertex to fix the line',
      drag: 'Release the cursor to lock the line.'
    },

    options: {
      stroke: true,
      color: 'green',
      weight: 2,
      opacity: 0.5,
      fill: false,
    },

    startMeasure: function (options) {
      this._setMouseMarker();
      options = options ? L.setOptions(this, options) : this.options;
      this.measureLayer = this._map.editTools.startPolyline(undefined, options);
      this.eventsOn('editable:', this.editableEventTree, true);
      this.isDragging = false;
    }
  });

  /**
    A class that provides support for major polygon editing events.
  */
  L.Measure.Polygon = L.Class.extend({
    includes: [L.Measure.Mixin, L.Measure.Mixin.Marker, L.Measure.Mixin.Path, L.Measure.Mixin.Polyline, L.Measure.Mixin.Polygon, L.Measure.Mixin.PolylinePolygonEvents],

    popupText: {
      move: 'Click on the map to add the starting vertex.',
      add: 'Click on the map to add a new vertex.',
      commit: 'Click on the current vertex to fix the polygon.',
      drag: 'Release the cursor to fix the polygon.'
    },

    options: {
      stroke: true,
      color: 'green',
      weight: 2,
      opacity: 0.5,
      fill: true,
    },


    startMeasure: function (options) {
      this._setMouseMarker();
      options = options ? L.setOptions(this, options) : this.options;
      this.measureLayer = this._map.editTools.startPolygon(undefined, options);
      this.isDragging = false;
      this.eventsOn('editable:', this.editableEventTree, true);
    }
  });


  /**
    Factory method for instantiating a marker measurement tool.
  */
  L.Measure.marker = function (map, options) {
    return new L.Measure.Marker(map, options);
  };

  /**
    Factory method for instantiating a rectangle measurement tool.
  */
  L.Measure.rectangle = function (map, options) {
    return new L.Measure.Rectangle(map, options);
  };

  /**
    Factory method for instantiating a circle measurement tool.
  */
  L.Measure.circle = function (map, options) {
    return new L.Measure.Circle(map, options);
  };

  /**
    Factory method for instantiating a polyline measurement tool.
  */
  L.Measure.polyline = function (map, options) {
    return new L.Measure.Polyline(map, options);
  };

  /**
    Factory method for instantiating a polygon measurement tool.
  */
  L.Measure.polygon = function (map, options) {
    return new L.Measure.Polygon(map, options);
  };

  /*
    If the basemeasured option is present, the method adds the measureTools property to the map with initialized properties:
    markerTool
    circleTool
    rectangleTool
    polylineTool
    polygonTool
  */
  L.Map.addInitHook(function () {
    this.whenReady(function () {
      if (this.options.measured) {
        this.measureTools = new L.Measure(this, this.options.measureOptions);
      }
    });
  });

  L.MeasureBase = L.Measure.extend({
    initialize: function (map, options) {
      L.Measure.prototype.initialize.call(this, map, options);
      this.markerBaseTool = L.Measure.markerBase(map, options);
      this.circleBaseTool = L.Measure.circleBase(map, options);
      this.rectangleBaseTool = L.Measure.rectangleBase(map, options);
      this.polylineBaseTool = L.Measure.polylineBase(map, options);
      this.polygonBaseTool = L.Measure.polygonBase(map, options);
    },

    stopMeasuring: function () {
      L.Measure.prototype.stopMeasuring.call(this);

      this.markerBaseTool.stopMeasure();
      this.circleBaseTool.stopMeasure();
      this.rectangleBaseTool.stopMeasure();
      this.polylineBaseTool.stopMeasure();
      this.polygonBaseTool.stopMeasure();
    }
  });

  /*
    The factory method for creating the base instance.
  */
  L.measureBase = function (map, options) {
    return new L.MeasureBase(map, options);
  };

  /**
    The class of the tool for measuring coordinates.
  */
  L.Measure.MarkerBase = L.Measure.Marker.extend({

    basePopupText: {
      labelPrefix: '<b>',
      labelPostfix: '</b>',
      captions: {
        northLatitude: ' N. ',
        southLatitude: ' S. ',
        eastLongitude: ' E. ',
        westLongitude: ' W. ',
        x: 'X: ',
        y: 'Y: '
      }
    },

    /**
      The number of characters after the decimal separator for measurements in meters.
    */
    precision: 5,

    /*
      Method for retrieving editing tool markers with labels
      @param {Object} editor Editing tool
      @returns {Object[]} An array of tagged marker editors.
    */
    _labelledMarkers: function (editor, e) {
      return [];
    },

    /*
      Method for retrieving unmarked editing tool markers
      @param {Object} editor Editing tool
      @returns {Object[]} An array of unlabeled editors tokens.
    */
    _unlabelledMarkers: function (editor, e) {
      return [];
    },

    /**
      Method for obtaining a textual description of the measurement results.
    */
    _getLabelContent: function (layer, latlng, e) {
      var crs = this.options.crs;
      var precision = this.options.precision || this.precision;
      var captions = this.options.captions || this.basePopupText.captions;
      var displayCoordinates = this.options.displayCoordinates || false;

      latlng = latlng || layer.getLatLng();
      var fixedLatLng = this.getFixedLatLng(latlng);

      if (crs) {
        var point = crs.project(fixedLatLng);
        if (point) {
          if (displayCoordinates) {
            return captions.x + point.x.toFixed(precision) + ' ' +
              captions.y + point.y.toFixed(precision);
          }

          return Math.abs(point.y).toFixed(precision) + (point.y >= 0 ? captions.northLatitude : captions.southLatitude) +
            Math.abs(point.x).toFixed(precision) + (point.x >= 0 ? captions.eastLongitude : captions.westLongitude);
        }
      }

      return Math.abs(fixedLatLng.lat).toFixed(precision) + (fixedLatLng.lat >= 0 ? captions.northLatitude : captions.southLatitude) +
        Math.abs(fixedLatLng.lng).toFixed(precision) + (fixedLatLng.lng >= 0 ? captions.eastLongitude : captions.westLongitude);
    },

    /**
      Method for updating the main label of the measured object
      @param {Object} layer Editable layer.
    */
    _updateMeasureLabel: function (layer, e) {
      if (this._getMeasureEventType(e).substr(-5) !== ':drag') {
        var text = this.basePopupText.labelPrefix + this._getLabelContent(layer, e.latlng, e) + this.basePopupText.labelPostfix;
        this._showLabel(layer, text);
      }
    },

  });

  /**
    Factory method for instantiating a coordinate measurement tool.
  */
  L.Measure.markerBase = function (map, options) {
    return new L.Measure.MarkerBase(map, options);
  };


  /**
    The class of the tool for measuring radius.
  */
  L.Measure.CircleBase = L.Measure.Circle.extend({

    basePopupText: {
      labelPrefix: '<b>Radius: ',
      labelPostfix: '</b>',
    },
    /*
     Method for retrieving editing tool markers with labels
     @param {Object} editor Editing tool
     @returns {Object[]} An array of tagged marker editors.
    */
    _labelledMarkers: function (editor, e) {
      var latlngs = editor.getLatLngs();
      var markers = [];
      switch (this._getMeasureEventType(e)) {
        case 'measure:create:drag':
        case 'measure:edit:drag':
          break;
        default:
          markers.push(latlngs[1].__vertex)
      }

      return markers;
    },

    /*
      Method for retrieving unmarked editing tool markers
      @param {Object} editor Editing tool
      @returns {Object[]} An array of unlabeled editors tokens.
    */
    _unlabelledMarkers: function (editor, e) {
      var latlngs = editor.getLatLngs();
      var markers = [];
      markers.push(latlngs[0].__vertex)
      switch (this._getMeasureEventType(e)) {
        case 'measure:create:drag':
        case 'measure:edit:drag':
          markers.push(latlngs[1].__vertex)
          break;
      }

      return markers;
    },


    /**
      Method for obtaining a textual description of the measurement results.
      @param {Object} layer Layer with geometry representing the measurements.
      @param {Object} latlng The geometry point for which you want to get a textual description of the dimensions.
    */
    _getLabelContent: function (layer, latlng, e) {
      var radiusText = this.getRadiusText(layer);
      var ret = radiusText.length > 0 ? this.basePopupText.labelPrefix + radiusText + this.basePopupText.labelPostfix : '';
      return ret;
    },

  });

  /**
    Factory method for instantiating a radius measurement tool.
  */
  L.Measure.circleBase = function (map, options) {
    return new L.Measure.CircleBase(map, options);
  };

  /**
    The class of a tool for measuring the area of a rectangle.
  */
  L.Measure.RectangleBase = L.Measure.Rectangle.extend({

    /*
      Method for retrieving editing tool markers with labels
      @param {Object} editor Editing tool
      @returns {Object[]} An array of tagged marker editors.
    */
    _labelledMarkers: function (editor) {
      var latlngs = editor.getLatLngs()[0];
      var markers = [];
      return markers;
    },

    /*
      Method for retrieving unmarked editing tool markers
      @param {Object} editor Editing tool
      @returns {Object[]} An array of unlabeled editors tokens.
    */
    _unlabelledMarkers: function (editor) {
      var latlngs = editor.getLatLngs()[0];
      var markers = [];
      for (var i = 0, len = latlngs.length; i < len; i++) {
        markers.push(latlngs[i].__vertex);
      }
      return markers;
    },

    /**
      Method for obtaining a textual description of the measurement results.
      @param {Object} layer Layer with geometry representing the measurements.
      @param {Object} latlng The geometry point for which you want to get a textual description of the dimensions.
    */
    _getLabelContent: function (layer, latlng) {
      return '';
    },

    /**
      Method for updating the main label of the measured object
      @param {Object} layer Editable layer.
    */
    _updateMeasureLabel: function (layer, e) {
      var center = layer.getCenter();
      //       var latlngs = layer.editor.getLatLngs()[0];
      var areaText = 'Area: ' + this.getAreaText(layer);
      areaText = '<b>' + areaText + '</b>';
      this._showLabel(layer, areaText, center);
    },

  });

  /**
   *  Factory method for creating an instance of a rectangle’s area measurement tool.
   */
  L.Measure.rectangleBase = function (map, options) {
    return new L.Measure.RectangleBase(map, options);
  };


  /**
   * Class of tool for measuring length.
   */
  L.Measure.PolylineBase = L.Measure.Polyline.extend({

    basePopupText: {
      distanceLabelPrefix: '<b>',
      distanceLabelPostfix: '</b>',
      incLabelPrefix: '<br/><span class="measure-path-label-incdistance">+',
      incLabelPostfix: '</span></b>',
    },

    /*
      Method for retrieving editing tool markers with labels
      @param {Object} editor Инструмент редактирования
      @returns {Object[]} Массив помеченных маркеров инструмента редактирования.
    */
    _labelledMarkers: function (editor, e) {
      var latlngs = editor.getLatLngs();
      var markers = [];
      var marker;
      switch (this._getMeasureEventType(e)) {
        case 'measure:create:drag':
        case 'measure:edit:drag':
          marker = e.vertex;
          break;
      }

      for (var i = 1, len = latlngs.length; i < len; i++) {
        var pathVertex = latlngs[i].__vertex;
        if (pathVertex !== marker) {
          markers.push(pathVertex);
        }
      }

      return markers;
    },

    /*
      A method for retrieving unmarked editing tool markers.
      @param {Object} editor Editing tool.
      @returns {Object[]} An array of unlabeled editors tokens.
    */
    _unlabelledMarkers: function (editor, e) {
      var latlngs = editor.getLatLngs();
      var markers = [];
      markers.push(latlngs[0].__vertex);
      switch (this._getMeasureEventType(e)) {
        case 'measure:create:drag':
        case 'measure:edit:drag':
          if (e.vertex) {
            markers.push(e.vertex);
          }

          break;
      }

      return markers;
    },

    /**
      Method for obtaining a textual description of the measurement results.
      @param {Object} layer Layer with geometry representing the measurements.
      @param {Object} latlng The geometry point for which you want to get a textual description of the dimensions.
      @param {Object} e Arguments of the method.
    */
    _getLabelContent: function (layer, latlng, e) {
      var latlngs = layer.editor.getLatLngs().slice();
      for (var index = 0; index < latlngs.length && !latlngs[index].equals(latlng); index++);

      if (index === latlngs.length) {
        latlngs.push(latlng);
      }

      if (index === 0) {
        return '';
      }

      var distance = 0;
      var currentInc = 0;
      for (var i = 1; i <= index; i++) {
        var prevLatLng = latlngs[i - 1];
        var currentLatLng = latlngs[i];
        currentInc = this.getDistance({
          latlng1: prevLatLng,
          latlng2: currentLatLng
        });
        distance += currentInc;
      }

      return this.basePopupText.distanceLabelPrefix +
        this.getMeasureText({
          value: distance,
          dimension: 1
        }) +
        this.basePopupText.distanceLabelPostfix +
        this.basePopupText.incLabelPrefix +
        this.getMeasureText({
          value: currentInc,
          dimension: 1
        }) +
        this.basePopupText.incLabelPostfix;
    },
  });

  /**
    Factory method for instantiating a length measurement tool.
  */
  L.Measure.polylineBase = function (map, options) {
    return new L.Measure.PolylineBase(map, options);
  };

  /**
    Class tool for measuring area.
  */
  L.Measure.PolygonBase = L.Measure.Polygon.extend({

    basePopupText: {
      labelPrefix: '<b>Area: ',
      labelPostfix: '</b>',
    },

    /*
      Method for retrieving editing tool markers with labels
      @param {Object} editor Editing tool
      @returns {Object[]} An array of tagged marker editors.
    */
    _labelledMarkers: function (editor, e) {
      var latlngs = editor.getLatLngs()[0];
      var markers = [];
      var marker;
      switch (this._getMeasureEventType(e)) {
        case 'measure:create:drag':
        case 'measure:edit:drag':
          break;
        case 'measure:created':
          marker = latlngs[latlngs.length - 1].__vertex;
          break;
        default:
          marker = e.vertex ? e.vertex : latlngs[latlngs.length - 1].__vertex;
      }

      if (marker) {
        markers.push(marker);
      }

      return markers;
    },

    /*
      Method for retrieving unmarked editing tool markers
      @param {Object} editor Editing tool
      @returns {Object[]} An array of unlabeled editors tokens.
    */
    _unlabelledMarkers: function (editor, e) {
      var latlngs = editor.getLatLngs()[0];
      var markers = [];
      var marker;
      switch (this._getMeasureEventType(e)) {
        case 'measure:create:drag':
        case 'measure:edit:drag':
          break;
        case 'measure:created':
          marker = latlngs[latlngs.length - 1].__vertex;
          break;
        default:
          marker = e.vertex ? e.vertex : latlngs[latlngs.length - 1].__vertex;
      }

      for (var i = 0, len = latlngs.length; i < len; i++) {
        var pathVertex = latlngs[i].__vertex;
        if (pathVertex !== marker) {
          markers.push(pathVertex);
        }
      }

      return markers;
    },

    /**
      Method for obtaining a textual description of the measurement results.
      @param {Object} layer Layer with geometry representing the measurements.
      @param {Object} latlng The geometry point for which you want to get a textual description of the dimensions.
      @param {Object} e Arguments of the method.
      @returns {String} Tag content
    */
    _getLabelContent: function (layer, latlng, e) {
      var latlngs = layer.editor.getLatLngs()[0].slice();
      var mouseLatlng;

      // Non drag.
      if (e && !e.vertex) {
        eventLatlng = e.latlng;
        for (var index = 0; index < latlngs.length && !latlngs[index].equals(eventLatlng); index++);
        if (index === latlngs.length) {
          mouseLatlng = eventLatlng;
        }
      }

      var ret = this.basePopupText.labelPrefix + this.getAreaText(layer, mouseLatlng) + this.basePopupText.labelPostfix;

      return ret;
    },
  });

  /**
   Factory method for creating an instance of an area measurement tool.
   */
  L.Measure.polygonBase = function (map, options) {
    return new L.Measure.PolygonBase(map, options);
  };

  /*
    If the basemeasured option is present, the method adds the measureTools property to the map with initialized properties:
    markerBaseTool
    circleBaseTool
    rectangleBaseTool
    polylineBaseTool
    polygonBaseTool
    markerTool
    circleTool
    rectangleTool
    polylineTool
    polygonTool
  */
  L.Map.addInitHook(function () {
    this.whenReady(function () {
      if (this.options.basemeasured) {
        this.measureTools = new L.MeasureBase(this, this.options.measureOptions);
      }
    });
  });

})(L);
