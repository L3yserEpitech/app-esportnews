import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_web_view.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'ads_model.dart';
export 'ads_model.dart';

class AdsWidget extends StatefulWidget {
  const AdsWidget({super.key});

  @override
  State<AdsWidget> createState() => _AdsWidgetState();
}

class _AdsWidgetState extends State<AdsWidget> {
  late AdsModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => AdsModel());

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return Container(
      width: 300.0,
      decoration: BoxDecoration(),
      child: Builder(
        builder: (context) {
          final activeAds = FFAppState().ads.toList();

          return ListView.separated(
            padding: EdgeInsets.zero,
            primary: false,
            shrinkWrap: true,
            scrollDirection: Axis.vertical,
            itemCount: activeAds.length,
            separatorBuilder: (_, __) => SizedBox(height: 20.0),
            itemBuilder: (context, activeAdsIndex) {
              final activeAdsItem = activeAds[activeAdsIndex];
              return InkWell(
                splashColor: Colors.transparent,
                focusColor: Colors.transparent,
                hoverColor: Colors.transparent,
                highlightColor: Colors.transparent,
                onTap: () async {
                  await launchURL(getJsonField(
                    activeAdsItem,
                    r'''$.redirect_link''',
                  ).toString());
                },
                child: Stack(
                  children: [
                    Container(
                      width: 300.0,
                      decoration: BoxDecoration(),
                      child: Builder(
                        builder: (context) {
                          if (FFAppConstants.imageExternal ==
                              getJsonField(
                                activeAdsItem,
                                r'''$.file_type''',
                              ).toString()) {
                            return ClipRRect(
                              borderRadius: BorderRadius.circular(8.0),
                              child: CachedNetworkImage(
                                fadeInDuration: Duration(milliseconds: 500),
                                fadeOutDuration: Duration(milliseconds: 500),
                                imageUrl: getJsonField(
                                  activeAdsItem,
                                  r'''$.url''',
                                ).toString(),
                                fit: BoxFit.cover,
                                alignment: Alignment(0.0, 0.0),
                                errorWidget: (context, error, stackTrace) =>
                                    Image.asset(
                                  'assets/images/error_image.png',
                                  fit: BoxFit.cover,
                                  alignment: Alignment(0.0, 0.0),
                                ),
                              ),
                            );
                          } else {
                            return FlutterFlowWebView(
                              content: getJsonField(
                                activeAdsItem,
                                r'''$.url''',
                              ).toString(),
                              bypass: false,
                              height: 300.0,
                              verticalScroll: false,
                              horizontalScroll: false,
                            );
                          }
                        },
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
