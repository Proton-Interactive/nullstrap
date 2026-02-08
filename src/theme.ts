import { extendTheme } from '@mui/joy/styles';

const pastelRed = {
  50: '#fff0f0',
  100: '#ffe4e4',
  200: '#ffc9c9',
  300: '#ffa3a3',
  400: '#fe968d',
  500: '#fe968d',
  600: '#e66a5c',
  700: '#cc4d41',
  800: '#a32f26',
  900: '#821a14',
};

export const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          ...pastelRed,
          solidBg: pastelRed[500],
          solidHoverBg: pastelRed[600],
          solidActiveBg: pastelRed[700],
          outlinedBorder: pastelRed[500],
          outlinedColor: pastelRed[500],
          plainColor: pastelRed[500],
        },
      },
    },
    dark: {
      palette: {
        primary: {
          ...pastelRed,
          solidBg: pastelRed[500],
          solidHoverBg: pastelRed[600],
          solidActiveBg: pastelRed[700],
          outlinedBorder: pastelRed[400],
          outlinedColor: pastelRed[400],
          plainColor: pastelRed[400],
        },
      },
    },
  },
});
