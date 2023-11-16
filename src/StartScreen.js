// @flow

import logo from "./logo.svg";
import "./App.css";
import { useEffect, useState } from "react";
import React from "react";
import { createTheme, ThemeProvider, styled } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import Box from "@mui/material/Box";

export const DEFAULT_DELAY = "5000";

const FileSelector = (props: { imagesFolder: ?string }) => {
  const selectImagesFolder = (e: SyntheticMouseEvent<HTMLElement>) => {
    window.ipcRenderer.send("select-dir");
  };
  const selectedFolder =
    props.imagesFolder !== null ? props.imagesFolder : "No selected folder";
  return (
    <div>
      <Button variant="contained" onClick={selectImagesFolder}>
        {"Select Folder"}
      </Button>
      <div>{selectedFolder}</div>
    </div>
  );
};

const StartSlideshowBtn = (props: {
  imagesFolder: ?string,
  onClick: () => void,
}) => {
  return (
    <div>
      <Button
        variant="contained"
        onClick={props.onClick}
        disabled={props.imagesFolder === null}
      >
        Start Slideshow
      </Button>
    </div>
  );
};

const ExitBtn = () => {
  return (
    <div>
      <Button variant="contained" onClick={() => window.close()}>
        Exit
      </Button>
    </div>
  );
};

const DelaySlider = () => {
  const savedDelay = localStorage.getItem("delay") ?? DEFAULT_DELAY;
  const [delay, setDelay] = useState<number>(Number.parseInt(savedDelay));
  const onChange = (e: SyntheticInputEvent<HTMLElement>) => {
    const newVal = Number.parseInt(e.target.value) * 1000;
    setDelay(newVal);
    localStorage.setItem("delay", String(newVal));
  };

  return (
    <div>
      <input
        type="range"
        min={1}
        max={120}
        value={delay / 1000}
        step={0.5}
        id="delay"
        onChange={onChange}
      />
      <label htmlFor="delay" style={{ marginLeft: "12px" }}>{`${
        delay / 1000
      } seconds`}</label>
    </div>
  );
};

function StartScreen(props: {
  onClickStart: () => void,
  imagesFolder: ?string,
}): React$Node {
  const [showLastSeen, setShowLastSeen] = useState<boolean>(
    localStorage.getItem("shouldShowLastSeen") === "true"
  );
  const theme = createTheme({
    palette: {
      mode: "dark",
    },
    typography: {
      h1: {
        fontWeight: "bold",
        fontSize: "6rem",
      },
    },
  });
  const NO_WARRANTY_TEXT =
    "No Warranties. EXCEPT AS OTHERWISE EXPRESSLY SET FORTH HEREIN, THE PARTIES MAKE NO REPRESENTATIONS AND EXTEND NO WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION, THERE ARE NO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR NON-MISAPPROPRIATION OF THIRD PARTY INTELLECTUAL PROPERTY RIGHTS, ARE MADE OR GIVEN BY OR ON BEHALF OF A PARTY. EACH PARTY MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE PATENTABILITY, VALIDITY OR ENFORCEABILITY OF ANY LICENSED PATENT RIGHTS. EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, ALL REPRESENTATIONS AND WARRANTIES, WHETHER ARISING BY OPERATION OF LAW OR OTHERWISE, ARE HEREBY EXPRESSLY EXCLUDED";

  const onToggleShouldShowLastSeen = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newVal = event.target.checked;
    localStorage.setItem("shouldShowLastSeen", newVal);
    setShowLastSeen(newVal);
  };

  const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
    ...theme.typography.body2,
    padding: theme.spacing(1),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    verticalAlign: "middle",
    color: theme.palette.text.primary,
    fontSize: "1.5rem",
  }));

  return (
    <ThemeProvider theme={theme}>
      <Box position="absolute" top="0px" left="0px" maxWidth="350px">
        <Typography sx={{ mb: 8, justifyContent: null }}>
          <Item sx={{ fontSize: "2rem" }}>Warranty Information</Item>
          <marquee
            behavior="scroll"
            direction="up"
            style={{ height: "200px" }}
            scrollamount="5"
          >
            <Item sx={{ fontSize: "1rem" }}>{NO_WARRANTY_TEXT}</Item>
          </marquee>
        </Typography>
      </Box>
      <div className="App-header">
        <Typography variant="h1" sx={{ mb: 8 }}>
          <div className="App-title">Shabshow</div>
        </Typography>
        <Stack spacing={2} justifyContent="center">
          <Stack direction={"row"} spacing={2} justifyContent="center">
            <Item>{"Selected folder"}</Item>
            <Item>
              <FileSelector imagesFolder={props.imagesFolder} />
            </Item>
          </Stack>
          <Stack direction={"row"} spacing={2}>
            <Item>{"Select delay"}</Item>
            <Item>
              <DelaySlider />
            </Item>
          </Stack>
          <Stack direction={"row"} spacing={2}>
            <Item>
              <Item>{"Show Last Seen Time"}</Item>
              <Checkbox
                onChange={onToggleShouldShowLastSeen}
                checked={showLastSeen}
              />
            </Item>
          </Stack>
          <Stack direction={"row"} spacing={2} justifyContent="center">
            <StartSlideshowBtn
              imagesFolder={props.imagesFolder}
              onClick={props.onClickStart}
            />
            <ExitBtn />
          </Stack>
        </Stack>
      </div>
    </ThemeProvider>
  );
}

export default StartScreen;
