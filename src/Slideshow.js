// @flow

import { useEffect, useRef, useState } from "react";
import React from "react";
import { DEFAULT_DELAY } from "./StartScreen";
import CircularProgress from "@mui/material/CircularProgress";

function Slideshow(props: { onClose: () => void }): React$Node {
  const rawDelay = localStorage.getItem("delay") ?? DEFAULT_DELAY;
  const delay = Number.parseInt(rawDelay);
  const [imgSrc, setImgSrc] = useState<?string>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  let timer = useRef<?TimeoutID>(null);
  let listener = null;

  const closeWindow = () => {
    window.removeEventListener("message", listener);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    setHasStarted(false);
    props.onClose();
  };

  const requestImage = () => window.ipcRenderer.send("request-image");
  const onLoad = () => {
    setHasError(false);
    timer.current = setTimeout(requestImage, delay);
  };
  const reportError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setHasError(true);
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      requestImage();
    }
    window.ipcRenderer.send(
      "report-error",
      event.currentTarget.src,
      event.type
    );
  };

  useEffect(() => {
    listener = (e: MessageEvent) => {
      if (!e.data || !e.data.type) {
        return;
      }

      if (e.data.type === "change-img" && typeof e.data.payload === "string") {
        const src: string = e.data.payload;
        setImgSrc(src);
      }
      if (e.data.type === "slideshow-ready") {
        setHasStarted(true);
        requestImage();
      }
    };
    window.addEventListener("mousedown", closeWindow);
    window.addEventListener("message", listener);
    return closeWindow;
  }, []);
  const formattedSrc = "atom://" + (imgSrc ?? "");
  const imageDiv =
    imgSrc !== null ? (
      <img
        src={formattedSrc}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
        onClick={closeWindow}
        onError={reportError}
        onLoad={onLoad}
      />
    ) : null;

  const spinner = (
    <div className={"Spinner"}>
      <CircularProgress size={80} />
    </div>
  );
  const image = <div className={"Slideshow-bg"}>{imageDiv}</div>;

  return hasStarted ? image : spinner;
}

export default Slideshow;
