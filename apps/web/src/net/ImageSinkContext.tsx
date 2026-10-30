import { createContext, useContext, type ReactNode } from 'react';
import { localImageSink, type ImageSink } from './imageSink';

const ImageSinkContext = createContext<ImageSink>(localImageSink);

export function ImageSinkProvider({ sink, children }: { sink: ImageSink; children: ReactNode }) {
  return <ImageSinkContext.Provider value={sink}>{children}</ImageSinkContext.Provider>;
}

export const useImageSink = (): ImageSink => useContext(ImageSinkContext);
