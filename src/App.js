// @flow

import logo from "./logo.svg";
import "./App.css";
import { useEffect, useState } from "react";
import React from "react";
import {
  HashRouter,
  BrowserRouter,
  Routes,
  Route,
  Link,
  Redirect,
} from "react-router-dom";
import StartScreen from "./StartScreen";
import Slideshow from "./Slideshow";

function App(): React$Node {
  const Router =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development"
      ? BrowserRouter
      : HashRouter;

  const [showSlideshow, setShowSlideshow] = useState<boolean>(false);
  useEffect(() => {
    document.title = "Shabshow";
  }, []);
  const [imagesFolder, setImagesFolder] = useState<?string>(
    localStorage.getItem("images_folder") ?? null
  );

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (!e.data || !e.data.type) {
        return;
      }

      if (
        e.data.type === "selected-dir" &&
        typeof e.data.payload === "string"
      ) {
        const folder: string = e.data.payload;
        setImagesFolder(folder);
        localStorage.setItem("images_folder", folder);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const startSlideshow = () => {
    window.ipcRenderer.send("start-slideshow", imagesFolder);
    setShowSlideshow(true);
  };

  console.log("### ENVIRONMENT ###");
  console.log(process.env.NODE_ENV);
  return showSlideshow ? (
    <Slideshow onClose={() => setShowSlideshow(false)} />
  ) : (
    <StartScreen imagesFolder={imagesFolder} onClickStart={startSlideshow} />
  );
}

export default App;
