"use client";

import React, { useState, useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import ThreejsOverlayView from "@ubilabs/threejs-overlay-view";
import { CatmullRomCurve3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";

import { getGeocode, getLatLng } from "use-places-autocomplete";

const mapOptions = {
  mapId: process.env.NEXT_PUBLIC_MAP_ID,
  center: { lat: 12.9716, lng: 77.5946 }, // Replace with the coordinates of Bangalore
  zoom: 18,
  disableDefaultUI: true,
  heading: 25,
  tilt: 60,
};

export default function App() {
  return (
    <Wrapper apiKey={process.env.NEXT_PUBLIC_MAP_API_KEY}>
      <MyMap />
    </Wrapper>
  );
}

// It is loading the map
function MyMap() {
  const [route, setRoute] = useState(null);
  const [map, setMap] = useState();
  const ref = useRef();

  useEffect(() => {
    setMap(new window.google.maps.Map(ref.current, mapOptions));
  }, []);

  return (
    <>
      <div ref={ref} id="map" />
      {map && <Directions setRoute={setRoute} />}
      {map && route && <Animation map={map} route={route} />}
    </>
  );
}

const Animation_MS = 10000;
const FRONT_VECTOR = new Vector3(0, -1, 0);

//Animation of model
function Animation({ map, route }) {
  const overlayRef = useRef();
  const trackRef = useRef();
  const carRef = useRef();

  useEffect(() => {
    map.setCenter(route[Math.floor(route.length / 2)], 17);

    if (!overlayRef.current) {
      overlayRef.current = new ThreejsOverlayView(mapOptions.center);
      overlayRef.current.setMap(map);
    }

    const scene = overlayRef.current.getScene();
    const points = route.map((p) => overlayRef.current.latLngAltToVector3(p));
    const curve = new CatmullRomCurve3(points);

    //Track
    if (trackRef.current) {
      scene.remove(trackRef.current);
    }

    trackRef.current = createTrackFromCurve(curve);
    scene.add(trackRef.current);

    loadModel().then((model) => {
      if (carRef.current) {
        scene.remove(carRef.current);
      }
      carRef.current = model;
      scene.add(carRef.current);
    });

    overlayRef.current.update = () => {
      trackRef.current.material.resolution.copy(
        overlayRef.current.getViewportSize()
      );

      if (carRef.current) {
        const progress = (performance.now() % Animation_MS) / Animation_MS;
        curve.getPointAt(progress, carRef.current.position);
        carRef.current.quaternion.setFromUnitVectors(
          FRONT_VECTOR,
          curve.getTangentAt(progress)
        );
        carRef.current.rotateX(Math.PI / 2);

        // console.log(progress);
      }

      overlayRef.current.requestRedraw();
    };
    return () => {
      scene.remove(trackRef.current);
      scene.remove(carRef.current);
    };
  }, [route, map]);

  return null;
}

// The track or the route of the road from the origin and direction.
function createTrackFromCurve(curve) {
  const points = curve.getSpacedPoints(curve.points.length * 10);
  const positions = points.map((point) => point.toArray()).flat();

  return new Line2(
    new LineGeometry().setPositions(positions),
    new LineMaterial({
      color: 0xffb703,
      linewidth: 8,
    })
  );

  // console.log(positions);
  // console.log(points);
}

//Loading the 3D Model
async function loadModel() {
  const loader = new GLTFLoader();
  const object = await loader.loadAsync("/man_walking/scene.gltf");
  const scene = object.scene;
  scene.scale.setScalar(0.5);

  return scene;
}

// Direction
function Directions({ setRoute }) {
  const [origin] = useState("27 Front St E Toronto");
  const [destination] = useState("75 Yonge Street Toronto");

  useEffect(() => {
    fetchDirections(origin, destination, setRoute);
  }, [origin, destination, setRoute]);

  return (
    <div className="directions">
      <h2>Directions</h2>
      <h3>Origin</h3>
      <p>{origin}</p>
      <h3>Destination</h3>
      <p>{destination}</p>
    </div>
  );
}

// Fetching the Directions
async function fetchDirections(origin, destination, setRoute) {
  const [originResults, destinationResults] = await Promise.all([
    getGeocode({ address: origin }),
    getGeocode({ address: destination }),
  ]);

  const [originLocation, destinationLocation] = await Promise.all([
    getLatLng(originResults[0]),
    getLatLng(destinationResults[0]),
  ]);

  const service = new google.maps.DirectionsService();
  service.route(
    {
      origin: originLocation,
      destination: destinationLocation,
      // travelMode: google.maps.TravelMode.DRIVING,
      travelMode: google.maps.TravelMode.WALKING,
    },
    (result, status) => {
      if (status === "OK" && result) {
        const route = result.routes[0].overview_path.map((path) => ({
          lat: path.lat(),
          lng: path.lng(),
        }));
        setRoute(route);
        // console.log(route);
      }
    }
  );
}
