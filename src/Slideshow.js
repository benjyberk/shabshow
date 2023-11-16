// @flow

import { useEffect, useRef, useState } from "react";
import React from "react";
import { DEFAULT_DELAY } from "./StartScreen";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar, { SnackbarOrigin } from "@mui/material/Snackbar";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

function Slideshow(props: { onClose: () => void }): React$Node {
  const rawDelay = localStorage.getItem("delay") ?? DEFAULT_DELAY;
  const showLastSeen = localStorage.getItem("shouldShowLastSeen") == "true";
  const delay = Number.parseInt(rawDelay);
  const [imgSrc, setImgSrc] = useState<?string>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  let timer = useRef<?TimeoutID>(null);
  const imgSrcRef = useRef<?string>(imgSrc);
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
  const markSeen = (file) => window.ipcRenderer.send("mark-seen", file);
  const onLoad = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(requestImage, delay);
  };
  const reportError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    requestImage();
    window.ipcRenderer.send(
      "report-error",
      event.currentTarget.src,
      event.type
    );
  };
  const handleSnackbarClose = () => setSnackbarOpen(false);

  const displayImg = (src: string, lastSeen: number) => {
    setImgSrc(src);
    markSeen(imgSrcRef.current);
    setLastSeen(lastSeen);

    if (showLastSeen) {
      setSnackbarOpen(true);
    }

    imgSrcRef.current = src;
  };

  useEffect(() => {
    listener = (e: MessageEvent) => {
      if (!e.data || !e.data.type) {
        return;
      }

      if (e.data.type === "change-img" && typeof e.data.payload === "string") {
        if (e.data.payload !== imgSrcRef.current) {
          const src: string = e.data.payload;
          displayImg(src, e.data.lastSeen);
        } else {
          if (timer.current !== null) {
            clearTimeout(timer.current);
          }
          requestImage();
        }
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

  let snackbar = null;
  if (lastSeen > 0) {
    const formattedSeen = "Last seen " + dayjs(lastSeen).fromNow();
    snackbar = (
      <Snackbar
        key={imgSrc}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={snackbarOpen}
        onClose={handleSnackbarClose}
        autoHideDuration={6000}
        message={formattedSeen}
      />
    );
  }

  const image = (
    <div className={"Slideshow-bg"}>
      {imageDiv}
      {snackbar}
    </div>
  );

  return hasStarted ? image : spinner;
}

export default Slideshow;
