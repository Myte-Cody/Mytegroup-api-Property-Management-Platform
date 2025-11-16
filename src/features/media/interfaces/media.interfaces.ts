export interface StorageDriverInterface {
  store(file: any, path: string): Promise<string>;
  delete(path: string): Promise<void>;
  getUrl(path: string, expiresIn?: number): Promise<string>;
  exists(path: string): Promise<boolean>;
}

export interface MediaServiceInterface {
  upload(
    file: any,
    entity: any,
    currentUser: any,
    collection?: string,
    disk?: any,
    modelType?: string,
  ): Promise<any>;

  getMediaForEntity(
    entityType: string,
    entityId: string,
    currentUser: any,
    collection?: string,
    filters?: any,
  ): Promise<any[]>;

  findOne(mediaId: string, currentUser: any): Promise<any>;
  deleteMedia(mediaId: string, currentUser: any): Promise<void>;
  getMediaUrl(media: any): Promise<string>;
}
