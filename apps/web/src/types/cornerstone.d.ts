interface CornerstoneApi {
  enable(element: HTMLElement): void;
  disable(element: HTMLElement): void;
  loadAndCacheImage(imageId: string): Promise<unknown>;
  displayImage(element: HTMLElement, image: unknown): void;
  resize(element: HTMLElement): void;
}

interface WadoImageLoaderApi {
  external: {
    cornerstone?: CornerstoneApi;
    dicomParser?: unknown;
  };
  webWorkerManager: {
    initialize(config: {
      maxWebWorkers: number;
      startWebWorkersOnDemand: boolean;
      taskConfiguration: {
        decodeTask: {
          initializeCodecsOnStartup: boolean;
          strict: boolean;
        };
      };
    }): void;
  };
}

declare module 'cornerstone-core' {
  const cornerstone: CornerstoneApi;
  export default cornerstone;
}

declare module 'cornerstone-wado-image-loader' {
  const loader: WadoImageLoaderApi;
  export default loader;
}

declare module 'dicom-parser' {
  const dicomParser: unknown;
  export default dicomParser;
}
